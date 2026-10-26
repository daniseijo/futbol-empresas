import Link from "next/link";
import { Crest } from "@/components/crest";
import { PlayerAvatar } from "@/components/player-avatar";
import { SectionCard } from "@/components/team/section-card";
import type { Position } from "@/lib/sportspress/types";
import type { IdealSevenData, IdealSlot } from "@/lib/views/ideal";

const scoreFormat = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** The ideal 7 on a vertical pitch: forwards at the top, the goalkeeper in goal. */
export function IdealSeven({
  lines,
  title = "7 ideal",
  aside,
  crests = true,
}: {
  lines: NonNullable<IdealSevenData>;
  title?: string;
  aside?: React.ReactNode;
  /** Each player's team crest: not needed when they all play for the same team. */
  crests?: boolean;
}) {
  return (
    <SectionCard title={title} aside={aside}>
      <div className="relative flex flex-col justify-around gap-2 overflow-hidden rounded-2xl border border-line bg-canvas px-2 py-4">
        <span aria-hidden="true">
          <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-line" />
          <span className="pointer-events-none absolute top-1/2 left-1/2 size-24 -translate-1/2 rounded-full border border-line" />
          <span className="pointer-events-none absolute right-1/4 bottom-0 left-1/4 h-[14%] border-x border-t border-line" />
          <span className="pointer-events-none absolute top-0 right-1/4 left-1/4 h-[14%] border-x border-b border-line" />
        </span>
        {lines.map((line) => (
          <ul key={line.position} aria-label={LINE_NAME[line.position]} className="relative flex justify-around">
            {line.players.map((player) => (
              <li key={player.playerId}>
                <Player player={player} position={line.position} crest={crests} />
              </li>
            ))}
          </ul>
        ))}
      </div>
      <p className="text-xs text-muted">
        Puntos del acta, más 1 por gol, 0,5 por asistencia, 2 por MVP, 1 por Dandy y, al portero, 2 por portería a cero.
      </p>
    </SectionCard>
  );
}

const LINE_NAME = { DEL: "Delanteros", MED: "Centrocampistas", DEF: "Defensas", POR: "Portero" } as const;

function Player({ player, position, crest }: { player: IdealSlot; position: Position; crest: boolean }) {
  const score = scoreFormat.format(player.score);
  return (
    <Link
      href={`/jugadores/${player.playerId}`}
      aria-label={`${player.name}, ${player.teamName}, ${score} puntos`}
      className="group flex w-24 flex-col items-center gap-1.5 rounded-xl px-1 py-1.5 text-center hover:bg-surface"
    >
      <span className="relative">
        <PlayerAvatar name={player.name} photoUrl={player.photoUrl} number={null} position={position} size={56} />
        {crest && (
          <span className="absolute -top-1 -right-2 rounded-full bg-surface p-0.5 shadow-[0_0_0_1px_var(--color-line)]">
            <Crest src={player.logoUrl} name={player.teamName} size={20} />
          </span>
        )}
        <span className="absolute -bottom-1 -left-2 rounded-full bg-accent px-1.5 font-display text-[13px] leading-[18px] font-extrabold text-on-accent">
          {score}
        </span>
      </span>
      <span className="line-clamp-2 text-xs leading-tight font-semibold group-hover:underline">{player.name}</span>
    </Link>
  );
}
