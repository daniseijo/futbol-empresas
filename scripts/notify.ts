// Usage:
//   pnpm notify                     announces the focus team's new or rescheduled matches
//   pnpm notify -- --dry-run        prints what it would send, sends and records nothing
//   pnpm notify -- --match=104101   sends that match's call-up now (a test), records nothing
// Channels: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID, SLACK_WEBHOOK_URL. With none
// set it only prints. GitHub Actions runs it after every sync.

import { runNotify } from "@/notify/run";

async function main() {
  const match = Number(process.argv.find((a) => a.startsWith("--match="))?.split("=")[1]);
  await runNotify({ dryRun: process.argv.includes("--dry-run"), matchId: match > 0 ? match : null });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
