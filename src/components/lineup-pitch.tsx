"use client";

import Link from "next/link";
import { useState } from "react";
import { cardsFor } from "@/lib/cards";
import { playerDisplayName } from "@/lib/players";
import type { LineupPlayer, Position } from "@/lib/sportspress/types";
import { Crest } from "./crest";
import { PlayerAvatar } from "./player-avatar";
import { CardIcon } from "./player-events";

export interface PitchSide {
  id: number;
  name: string;
  logoUrl: string | null;
  lineup: LineupPlayer[];
}

/** From the goal outwards. */
const LINES: Position[] = ["POR", "DEF", "MED", "DEL"];
/** More players than this in a line and it splits in two: a column of the horizontal pitch is taller than a row is wide. */
const LINE_MAX = { across: 4, along: 6 };

const POSITION_NAME: Record<Position, string> = { POR: "portero", DEF: "defensa", MED: "centrocampista", DEL: "delantero" };

/** Words that belong to the surname that follows them, and initials. */
const PARTICLE = /^(de|del|la|las|los|y|san|\p{L}\.)$/iu;

/** First name and first surname ("Telmo Lertxundi", "David de la Fuente"), or "Dorsal 7" for a private profile. */
function shortName(p: LineupPlayer): string {
  if (!p.name) return playerDisplayName(p.name, p.number);
  const [first, ...rest] = p.name.split(/\s+/);
  const surname: string[] = [];
  for (const word of rest) {
    surname.push(word);
    if (!PARTICLE.test(word)) break;
  }
  return [first, ...surname].join(" ");
}

function describe(p: LineupPlayer): string {
  const cards = cardsFor(p.yellowCards, p.redCards).map((kind) =>
    kind === "yellow" ? "tarjeta amarilla" : kind === "red" ? "tarjeta roja" : "doble amarilla",
  );
  return [
    playerDisplayName(p.name, p.number),
    p.position && POSITION_NAME[p.position],
    p.name && p.number ? `dorsal ${p.number}` : null,
    p.goals > 0 && `${p.goals} ${p.goals === 1 ? "gol" : "goles"}`,
    p.assists > 0 && `${p.assists} ${p.assists === 1 ? "asistencia" : "asistencias"}`,
    ...cards,
    p.crack && "MVP del partido",
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * The lineups on a pitch: on large screens a horizontal pitch with the home team
 * on the left; on phones one team at a time on a vertical half. The league
 * only gives each player's line, not a formation, and lists everyone who
 * played, so a team can have 10-14 players on it.
 */
export function LineupPitch({ home, away }: { home: PitchSide; away: PitchSide }) {
  const [shown, setShown] = useState<"home" | "away">("home");
  const side = shown === "home" ? home : away;
  return (
    <div className="flex flex-col gap-3">
      <div className="hidden md:flex md:flex-col md:gap-2">
        <div className="flex items-center justify-between gap-3 text-sm font-bold">
          <TeamLabel side={home} />
          <TeamLabel side={away} reverse />
        </div>
        <div className="relative flex min-h-[420px] overflow-hidden rounded-2xl border border-line bg-canvas">
          <HorizontalMarkings />
          <Half side={home} direction="row" />
          <Half side={away} direction="row-reverse" />
        </div>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        <fieldset className="grid grid-cols-2 gap-1.5">
          <legend className="sr-only">Equipo</legend>
          {(["home", "away"] as const).map((key) => {
            const team = key === "home" ? home : away;
            return (
              <label
                key={key}
                className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-2.5 py-2 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-text ${
                  shown === key ? "border-ink font-semibold" : "border-line text-muted"
                }`}
              >
                <input type="radio" name="campo-equipo" checked={shown === key} onChange={() => setShown(key)} className="sr-only" />
                <Crest src={team.logoUrl} name={team.name} size={22} />
                <span className="truncate">{team.name}</span>
              </label>
            );
          })}
        </fieldset>
        <div className="relative flex min-h-[460px] overflow-hidden rounded-2xl border border-line bg-canvas">
          <VerticalMarkings />
          <Half side={side} direction="column-reverse" />
        </div>
      </div>

      {[home, away].map((team) => {
        const loose = team.lineup.filter((p) => p.position === null);
        if (loose.length === 0) return null;
        return (
          <div key={team.id} className="flex flex-col gap-2 rounded-xl border border-line-soft px-3 py-2.5">
            <span className="text-xs text-muted">Sin posición · {team.name}</span>
            <div className="flex flex-wrap gap-3">
              {loose.map((p) => (
                <Player key={p.playerId} player={p} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TeamLabel({ side, reverse = false }: { side: PitchSide; reverse?: boolean }) {
  return (
    <span className={`flex min-w-0 items-center gap-2 ${reverse ? "flex-row-reverse text-right" : ""}`}>
      <Crest src={side.logoUrl} name={side.name} size={24} />
      <span className="truncate">{side.name}</span>
    </span>
  );
}

/**
 * One team's half: its lines from the goal outwards, along `direction`
 * (left to right, right to left, or bottom to top).
 */
function Half({ side, direction }: { side: PitchSide; direction: "row" | "row-reverse" | "column-reverse" }) {
  const vertical = direction === "column-reverse";
  // Empty lines keep their place: a team without a goalkeeper does not put its defenders in goal.
  const lines = LINES.map((position) => ({ position, players: side.lineup.filter((p) => p.position === position) }));
  return (
    <ul
      aria-label={`Alineación de ${side.name}`}
      className={`relative flex min-w-0 flex-1 basis-0 ${vertical ? "flex-col-reverse py-4" : direction === "row" ? "flex-row px-2" : "flex-row-reverse px-2"}`}
    >
      {lines.map(({ position, players: line }) => {
        // A crowded line splits into two rows (or columns), the first one nearer the goal.
        const max = vertical ? LINE_MAX.across : LINE_MAX.along;
        const halves = line.length > max ? [line.slice(0, Math.ceil(line.length / 2)), line.slice(Math.ceil(line.length / 2))] : [line];
        return (
          <li
            key={position}
            className={`flex min-w-0 basis-0 ${vertical ? "flex-col-reverse" : direction === "row" ? "flex-row" : "flex-row-reverse"}`}
            // A line split in two takes twice the room.
            style={{ flexGrow: halves.length }}
          >
            {halves.map((players, index) => (
              <ul
                key={index}
                className={`flex min-w-0 flex-1 items-center justify-around gap-1 ${vertical ? "flex-row py-1" : "flex-col px-0.5 py-3"}`}
              >
                {players.map((p) => (
                  <li key={p.playerId}>
                    <Player player={p} />
                  </li>
                ))}
              </ul>
            ))}
          </li>
        );
      })}
    </ul>
  );
}

function Player({ player: p }: { player: LineupPlayer }) {
  const cards = cardsFor(p.yellowCards, p.redCards);
  return (
    <Link
      href={`/jugadores/${p.playerId}`}
      aria-label={describe(p)}
      className="group flex w-[68px] flex-col items-center gap-1 rounded-lg px-0.5 py-1 text-center hover:bg-surface"
    >
      <span className="relative">
        <PlayerAvatar name={p.name} photoUrl={p.photoUrl} number={p.number} position={p.position} size={38} />
        {p.crack && (
          <span className="absolute -top-1 -right-2 rounded bg-accent px-1 text-[9px] leading-[14px] font-extrabold text-on-accent">
            MVP
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-[11px] leading-tight font-semibold group-hover:underline">{shortName(p)}</span>
      {(p.goals > 0 || cards.length > 0) && (
        <span className="flex items-center gap-1 text-[11px] leading-none font-semibold">
          {p.goals > 0 && <span>{p.goals > 1 ? `● ${p.goals}` : "●"}</span>}
          {cards.map((kind) => (
            <CardIcon key={kind} kind={kind} />
          ))}
        </span>
      )}
    </Link>
  );
}

const MARK = "pointer-events-none absolute border-line";

function HorizontalMarkings() {
  return (
    <span aria-hidden="true">
      <span className={`${MARK} inset-y-0 left-1/2 border-l`} />
      <span className={`${MARK} top-1/2 left-1/2 size-28 -translate-1/2 rounded-full border`} />
      <span className={`${MARK} top-1/4 bottom-1/4 left-0 w-[13%] border-y border-r`} />
      <span className={`${MARK} top-1/4 bottom-1/4 right-0 w-[13%] border-y border-l`} />
    </span>
  );
}

function VerticalMarkings() {
  return (
    <span aria-hidden="true">
      {/* The halfway line at the top, with half the centre circle; the goal at the bottom. */}
      <span className={`${MARK} -top-14 left-1/2 size-28 -translate-x-1/2 rounded-full border`} />
      <span className={`${MARK} right-1/4 bottom-0 left-1/4 h-[16%] border-x border-t`} />
    </span>
  );
}
