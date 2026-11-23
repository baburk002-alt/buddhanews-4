/**
 * Retention job for an external scheduler (cron, Kubernetes CronJob, platform
 * "scheduled task"):
 *
 *   pnpm db:cleanup                  (from a checkout)
 *   node dist/maintenance.js         (from the production build)
 *
 * The app also runs this itself once a day (server/scheduler.ts) unless
 * DISABLE_INTERNAL_SCHEDULER=true. Running both is safe: the CLI always runs;
 * the in-process job is skipped when it already ran within the interval.
 *
 * It removes only derived data (view rows, expired sessions, stale pending
 * subscriptions, old audit entries, delivered mail); stories, revisions and
 * confirmed subscribers are never deleted here.
 */
import "dotenv/config";
import { runRetentionCleanup } from "../maintenance";
import { processOutbox } from "../mailer";

async function main() {
  const result = await runRetentionCleanup();
  console.log(
    `[Cleanup] views=${result.views} pendingSubscriptions=${result.pending} sessions=${result.sessions} auditRows=${result.auditRows} outbox=${result.outbox}`
  );
  if (process.argv.includes("--mail")) {
    const mail = await processOutbox(100);
    console.log(
      `[Mail] claimed=${mail.claimed} sent=${mail.sent} retried=${mail.retried} failed=${mail.failed} expired=${mail.expired}`
    );
  }
  process.exit(0);
}
main().catch(error => {
  console.error("[Cleanup] failed", error);
  process.exit(1);
});
