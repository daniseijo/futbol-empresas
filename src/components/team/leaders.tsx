import type { SquadPlayer } from "@/lib/sportspress/types";
import { PlayerAvatar } from "../player-avatar";

const money = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const GROUPS = [
  { title: "Goles", key: "goals" as const, format: (v: number) => String(v) },
  { title: "Asistencias", key: "assists" as const, format: (v: number) => String(v) },
  { title: "Puntos MVP", key: "mvpPoints" as const, format: (v: number) => v.toFixed(1) },
];

function topBy(squad: SquadPlayer[], key: "goals" | "assists" | "mvpPoints") {
  return [...squad].filter((p) => p[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, 3);
}

/** Líderes del equipo en goles, asistencias y puntos MVP. */
export function Leaders({ squad, columns = 3 }: { squad: SquadPlayer[]; columns?: 1 | 3 }) {
  return (
    <div className={`grid gap-3.5 ${columns === 3 ? "grid-cols-[repeat(auto-fit,minmax(220px,1fr))]" : ""}`}>
      {GROUPS.map((group) => {
        const [first, ...rest] = topBy(squad, group.key);
        return (
          <div key={group.key} className="flex flex-col gap-2.5 rounded-[18px] bg-canvas p-4.5">
            <div className="text-xs font-bold tracking-[0.1em] text-muted uppercase">{group.title}</div>
            {first ? (
              <>
                <div className="flex items-center justify-between gap-2.5">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <PlayerAvatar name={first.name} photoUrl={first.photoUrl} number={first.number} position={first.position} />
                    <b className="truncate">{first.name}</b>
                  </span>
                  <span className="font-display text-[42px] leading-none font-extrabold text-accent-text">{group.format(first[group.key])}</span>
                </div>
                {rest.map((player) => (
                  <div key={player.id} className="flex justify-between gap-2 border-t border-line pt-2 text-sm">
                    <span className="truncate text-[#3a4350]">{player.name}</span>
                    <b>{group.format(player[group.key])}</b>
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-muted">Sin datos todavía.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Los cinco jugadores con más valor de mercado, en barras. */
export function MarketValue({ squad }: { squad: SquadPlayer[] }) {
  const top = [...squad].sort((a, b) => b.marketValue - a.marketValue).slice(0, 5);
  const max = top[0]?.marketValue ?? 0;
  if (max === 0) return null;
  return (
    <section className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-5">
      <h2 className="font-display text-2xl font-extrabold uppercase">Valor de mercado</h2>
      {top.map((player) => (
        <div key={player.id} className="flex flex-col gap-1.5">
          <div className="flex justify-between gap-2 text-sm">
            <span className="truncate">{player.name}</span>
            <b className="whitespace-nowrap">{money.format(player.marketValue)} M€</b>
          </div>
          <div className="h-1.5 rounded-full bg-line-soft">
            <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.round((player.marketValue / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </section>
  );
}
