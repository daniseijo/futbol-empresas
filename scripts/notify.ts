// Usage:
//   pnpm notify                     announces new or rescheduled matches (focus team and Slack subscriptions)
//   pnpm notify -- --dry-run        prints what it would send, sends and records nothing
//   pnpm notify -- --match=104101   sends that match's call-up now (a test), records nothing
//   pnpm notify -- --match=104101 --to=sub:3   …only to that channel ("telegram", "slack" or a subscription)
// Channels: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID, SLACK_WEBHOOK_URL, plus the
// subscriptions table (NOTIFY_ENCRYPTION_KEY decrypts its webhooks). With none
// it only prints. GitHub Actions runs it after every sync.

import { runNotify } from "@/notify/run";

async function main() {
  const option = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] || null;
  const match = Number(option("match"));
  await runNotify({ dryRun: process.argv.includes("--dry-run"), matchId: match > 0 ? match : null, to: option("to") });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
