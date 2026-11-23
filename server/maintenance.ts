/**
 * Data-retention maintenance, shared by every way it can be triggered:
 *
 *  - the in-process scheduler (server/scheduler.ts, daily by default),
 *  - `pnpm db:cleanup` / `node dist/maintenance.js` from an external cron,
 *  - the admin "Run cleanup now" button (maintenance.cleanup).
 *
 * It removes only derived or expiring data. Stories, revisions, media and
 * confirmed subscribers are never touched.
 */
import { getRetentionPolicy } from "./config";
import * as db from "./db";

export type RetentionResult = {
  views: number;
  pending: number;
  sessions: number;
  auditRows: number;
  outbox: number;
};

export async function runRetentionCleanup(): Promise<RetentionResult> {
  const policy = getRetentionPolicy();
  const [views, pending, sessions, auditRows, outbox] = await Promise.all([
    db.cleanupArticleViews(policy.viewsDays),
    db.cleanupPendingSubscriptions(policy.pendingDays),
    db.pruneSessions(),
    db.cleanupAuditLogs(policy.auditDays),
    db.cleanupEmailOutbox(policy.outboxDays),
  ]);
  return { views, pending, sessions, auditRows, outbox };
}

/** Settings key used to coordinate instances. Underscore-prefixed keys are hidden from the admin UI and public API. */
export const LAST_CLEANUP_KEY = "_maintenance.lastCleanupAt";

/**
 * Run the cleanup at most once per `intervalMs` across ALL app instances.
 * The claim is a compare-and-swap on one `site_settings` row, so two replicas
 * starting at the same moment cannot both run it. Returns null when another
 * instance already ran (or is running) it within the interval.
 */
export async function runRetentionIfDue(intervalMs: number): Promise<RetentionResult | null> {
  const claimed = await db.claimMaintenanceSlot(LAST_CLEANUP_KEY, intervalMs);
  if (!claimed) return null;
  try {
    return await runRetentionCleanup();
  } catch (error) {
    // Release the slot so the next tick retries instead of waiting a full day.
    await db.releaseMaintenanceSlot(LAST_CLEANUP_KEY).catch(() => undefined);
    throw error;
  }
}
