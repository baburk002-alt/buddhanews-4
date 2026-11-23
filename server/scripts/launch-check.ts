/**
 * Pre-launch gate:
 *
 *   pnpm launch:check            (checkout)
 *   node dist/launch-check.js    (production build)
 *
 * Prints every blocker/warning and exits 1 when blockers remain, so it can sit
 * in a deploy pipeline in front of "go live". Reads the same environment and
 * database the app uses.
 */
import "dotenv/config";
import { evaluateLaunchReadiness, formatLaunchReport } from "../launchCheck";

async function main() {
  const report = await evaluateLaunchReadiness();
  console.log(formatLaunchReport(report));
  process.exit(report.ready ? 0 : 1);
}
main().catch(error => {
  console.error("[Launch] check failed", error);
  process.exit(2);
});
