/**
 * In-process scheduler (item: automated retention + mail delivery).
 *
 *  - Retention cleanup every `CLEANUP_INTERVAL_HOURS` (default 24). The first
 *    check happens shortly after boot, so a process that restarts often still
 *    cleans up; a database lock (server/maintenance.ts) makes sure only one
 *    instance per interval actually runs it.
 *  - Email outbox drain every minute (retries with backoff).
 *
 * Disable with `DISABLE_INTERNAL_SCHEDULER=true` when the platform runs
 * `node dist/maintenance.js` (or `pnpm db:cleanup`) from its own cron, or
 * when the host sleeps between requests (serverless / scale-to-zero) — those
 * hosts need the external schedule because an idle process has no timers.
 */
import { getEmailConfig, getSchedulerConfig } from "./config";
import { processOutbox } from "./mailer";
import { runRetentionIfDue } from "./maintenance";

export type SchedulerHandle = { stop: () => void };

const FIRST_CHECK_DELAY_MS = 30_000;
/** How often to re-check whether the daily job is due. */
const CHECK_EVERY_MS = 10 * 60_000;

export function startScheduler(): SchedulerHandle | null {
  const config = getSchedulerConfig();
  if (!config.enabled) {
    console.log("[Scheduler] Disabled (DISABLE_INTERNAL_SCHEDULER=true). Run the cleanup from cron.");
    return null;
  }
  let stopped = false;
  const timers: NodeJS.Timeout[] = [];

  const cleanupTick = async () => {
    if (stopped) return;
    try {
      const result = await runRetentionIfDue(config.cleanupIntervalMs);
      if (result) {
        console.log(
          `[Cleanup] views=${result.views} pendingSubscriptions=${result.pending} sessions=${result.sessions} auditRows=${result.auditRows} outbox=${result.outbox}`
        );
      }
    } catch (error) {
      console.error("[Cleanup] failed", error instanceof Error ? error.message : error);
    }
  };
  const outboxTick = async () => {
    if (stopped || !getEmailConfig().deliveryConfigured) return;
    try {
      const result = await processOutbox(50);
      if (result.claimed > 0 || result.expired > 0) {
        console.log(
          `[Mail] claimed=${result.claimed} sent=${result.sent} retried=${result.retried} failed=${result.failed} expired=${result.expired}`
        );
      }
    } catch (error) {
      console.error("[Mail] outbox run failed", error instanceof Error ? error.message : error);
    }
  };

  const first = setTimeout(() => {
    void cleanupTick();
    void outboxTick();
  }, FIRST_CHECK_DELAY_MS);
  timers.push(first);
  timers.push(setInterval(cleanupTick, CHECK_EVERY_MS));
  timers.push(setInterval(outboxTick, config.outboxIntervalMs));
  for (const timer of timers) timer.unref();

  console.log(
    `[Scheduler] Retention cleanup every ${Math.round(config.cleanupIntervalMs / 3_600_000)}h, mail outbox every ${Math.round(config.outboxIntervalMs / 1000)}s`
  );
  return {
    stop: () => {
      stopped = true;
      for (const timer of timers) clearTimeout(timer);
    },
  };
}
