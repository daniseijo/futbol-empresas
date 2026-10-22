import Link from "next/link";
import type { StandingRow } from "@/lib/sportspress/types";
import { goalDifference } from "@/lib/standings";
import { Crest } from "../crest";
import { FormBadges } from "../form-badges";

interface Props {
  rows: StandingRow[];
  teamId: number;
  logos: Record<number, string | null>;
  slugs: Record<number, string>;
}

const signed = (n: number) => (n > 0 ? `+${n}` : String(n));

/** Clasificación completa del grupo, con forma reciente. */
export function StandingsTable({ rows, teamId, logos, slugs }: Props) {
  const columns = "grid-cols-[26px_30px_minmax(150px,1fr)_repeat(7,36px)_44px_112px]";
  return (
    <div className="-mx-2 overflow-x-auto px-2">
      <div className="min-w-[720px]">
        <div className={`grid ${columns} gap-2 px-1.5 pb-2 text-xs font-semibold text-muted`}>
          <span>#</span>
          <span />
          <span>Equipo</span>
          {["PJ", "G", "E", "P", "GF", "GC", "DG"].map((label) => (
            <span key={label} className="text-right">
              {label}
            </span>
          ))}
          <span className="text-right text-ink">PTS</span>
          <span className="text-right">Últimos</span>
        </div>
        {rows.map((row) => {
          const own = row.teamId === teamId;
          return (
            <Link
              key={row.teamId}
              href={`/equipos/${slugs[row.teamId] ?? ""}`}
              className={`grid ${columns} items-center gap-2 rounded-[10px] px-1.5 py-2 ${own ? "bg-accent font-bold text-on-accent" : "hover:bg-canvas"}`}
            >
              <span className="text-sm font-bold">{row.position}</span>
              <Crest src={logos[row.teamId]} name={row.name} size={28} />
              <span className="truncate text-sm">{row.name}</span>
              {[row.played, row.won, row.drawn, row.lost, row.goalsFor, row.goalsAgainst].map((value, index) => (
                <span key={index} className="text-right text-[13px]">
                  {value}
                </span>
              ))}
              <span className="text-right text-[13px]">{signed(goalDifference(row))}</span>
              <span className="text-right font-display text-xl font-extrabold">{row.points}</span>
              <span className="flex justify-end">
                <FormBadges form={row.form} size={20} />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/** Trozo de la clasificación alrededor del equipo (para el resumen). */
export function StandingsZone({ rows, teamId, logos, slugs, size = 5 }: Props & { size?: number }) {
  const index = rows.findIndex((r) => r.teamId === teamId);
  const start = Math.max(0, Math.min(index - Math.floor(size / 2), rows.length - size));
  const zone = index >= 0 ? rows.slice(start, start + size) : rows.slice(0, size);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="grid grid-cols-[22px_28px_1fr_28px_22px_34px] gap-2 px-1.5 pb-1 text-xs text-muted">
        <span />
        <span />
        <span />
        <span className="text-right">PTS</span>
        <span className="text-right">PJ</span>
        <span className="text-right">DG</span>
      </div>
      {zone.map((row) => {
        const own = row.teamId === teamId;
        return (
          <Link
            key={row.teamId}
            href={`/equipos/${slugs[row.teamId] ?? ""}`}
            className={`grid grid-cols-[22px_28px_1fr_28px_22px_34px] items-center gap-2 rounded-[10px] px-1.5 py-1.5 ${
              own ? "bg-accent font-bold text-on-accent" : "hover:bg-canvas"
            }`}
          >
            <span className="text-sm font-bold">{row.position}</span>
            <Crest src={logos[row.teamId]} name={row.name} size={28} />
            <span className="truncate text-sm">{row.name}</span>
            <span className="text-right font-bold">{row.points}</span>
            <span className="text-right text-[13px]">{row.played}</span>
            <span className="text-right text-[13px]">{signed(goalDifference(row))}</span>
          </Link>
        );
      })}
    </div>
  );
}
