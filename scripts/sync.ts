// Usage:
//   pnpm sync                       resumes the backfill and pulls the latest changes
//   pnpm sync -- --budget=600       same, but stops after 600 s (GitHub Actions uses it)
//   pnpm sync -- --matches=1,2      downloads those matches again, then carries on
//   pnpm sync:reset                 downloads everything again from scratch
// When done, if REVALIDATE_URL and REVALIDATE_SECRET are set, it tells the site
// to refresh its cache.

import { runSync } from "@/sync/run";

function budgetFromArgs(): number {
  const arg = process.argv.find((a) => a.startsWith("--budget="));
  return Number(arg?.split("=")[1] ?? process.env.SYNC_BUDGET_SECONDS ?? 0) || 0;
}

async function main() {
  const matchIds = (process.argv.find((a) => a.startsWith("--matches="))?.split("=")[1] ?? "")
    .split(",")
    .map(Number)
    .filter((id) => id > 0);
  const result = await runSync({ reset: process.argv.includes("--reset"), budgetSeconds: budgetFromArgs(), matchIds });

  const url = process.env.REVALIDATE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (url && secret && (result.writes > 0 || result.searchChanged)) {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ search: result.searchChanged }),
    });
    console.log(`Site revalidation: ${res.status}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
