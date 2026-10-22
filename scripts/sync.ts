// Uso:
//   pnpm sync                       sigue la carga donde se quedó y trae los cambios
//   pnpm sync -- --budget=600       igual, pero para a los 600 s (lo usa GitHub Actions)
//   pnpm sync -- --partidos=1,2     vuelve a descargar esos partidos y sigue
//   pnpm sync:reset                 vuelve a descargar todo desde cero
// Al terminar, si hay REVALIDATE_URL y REVALIDATE_SECRET, avisa a la web para que
// refresque su caché.

import { runSync } from "@/sync/run";

function budgetFromArgs(): number {
  const arg = process.argv.find((a) => a.startsWith("--budget="));
  return Number(arg?.split("=")[1] ?? process.env.SYNC_BUDGET_SECONDS ?? 0) || 0;
}

async function main() {
  const matchIds = (process.argv.find((a) => a.startsWith("--partidos="))?.split("=")[1] ?? "")
    .split(",")
    .map(Number)
    .filter((id) => id > 0);
  const result = await runSync({ reset: process.argv.includes("--reset"), budgetSeconds: budgetFromArgs(), matchIds });

  const url = process.env.REVALIDATE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (url && secret && result.writes > 0) {
    const res = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
    console.log(`Revalidación de la web: ${res.status}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
