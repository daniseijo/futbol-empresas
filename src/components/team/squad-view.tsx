"use client";

import Link from "next/link";
import { useState } from "react";
import type { Position, SquadPlayer } from "@/lib/sportspress/types";
import { PlayerAvatar } from "../player-avatar";

const money = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const POSITION_LABEL: Record<Position, string> = { POR: "Porteros", DEF: "Defensas", MED: "Medios", DEL: "Delanteros" };
const ORDER: (Position | null)[] = ["POR", "DEF", "MED", "DEL", null];
const COLUMNS = "grid-cols-[44px_1fr_32px_40px_40px_84px]";

function PlayerRow({ player, rank }: { player: SquadPlayer; rank?: number }) {
  return (
    <Link href={`/jugadores/${player.id}`} className={`grid ${COLUMNS} items-center gap-2 border-t border-line-soft py-2 text-sm hover:bg-canvas`}>
      <PlayerAvatar name={player.name} photoUrl={player.photoUrl} number={player.number} position={player.position} size={36} />
      <span className="min-w-0 truncate font-semibold">
        {rank !== undefined && <span className="mr-2 font-normal text-muted">{rank}.</span>}
        {player.name || "Sin nombre"}
        {player.photoUrl && player.number ? <span className="ml-1.5 font-normal text-muted">#{player.number}</span> : null}
      </span>
      <span className="text-right">{player.appearances}</span>
      <span className="text-right">{player.goals}</span>
      <span className="text-right">{player.assists}</span>
      <span className="text-right font-semibold">{money.format(player.marketValue)} M€</span>
    </Link>
  );
}

/** Plantilla agrupada por posición u ordenada por valor de mercado. */
export function SquadView({ squad }: { squad: SquadPlayer[] }) {
  const [view, setView] = useState<"position" | "value">("position");
  const total = squad.reduce((sum, p) => sum + p.marketValue, 0);
  const byValue = [...squad].sort((a, b) => b.marketValue - a.marketValue || b.mvpPoints - a.mvpPoints);

  return (
    <section className="flex min-w-0 flex-col gap-2.5 rounded-[22px] border border-line bg-surface p-5.5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-[28px] font-extrabold uppercase">Plantilla</h2>
        <div className="flex gap-1.5" role="group" aria-label="Ordenar la plantilla">
          {(
            [
              ["position", "Por posición"],
              ["value", "Por valor"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
                view === key ? "border-accent bg-accent-soft text-accent-text" : "border-line text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted">
        {squad.length} jugadores · valor de mercado total <b className="text-ink">{money.format(total)} M€</b>
      </p>
      <div className={`grid ${COLUMNS} gap-2 pt-1 text-xs text-muted`}>
        <span />
        <span />
        <span className="text-right">PJ</span>
        <span className="text-right">GOL</span>
        <span className="text-right">ASIS</span>
        <span className="text-right">VALOR</span>
      </div>

      {view === "position"
        ? ORDER.map((position) => {
            const players = byValue.filter((p) => p.position === position);
            if (players.length === 0) return null;
            return (
              <div key={position ?? "otros"} className="flex flex-col">
                <h3 className="pt-2 pb-1 text-xs font-bold tracking-[0.1em] text-muted uppercase">
                  {position ? POSITION_LABEL[position] : "Sin posición"} · {players.length}
                </h3>
                {players.map((player) => (
                  <PlayerRow key={player.id} player={player} />
                ))}
              </div>
            );
          })
        : byValue.map((player, index) => <PlayerRow key={player.id} player={player} rank={index + 1} />)}

      <p className="pt-2 text-xs text-muted">Valor ficticio que calcula la liga a partir de puntos, goles y premios.</p>
    </section>
  );
}
