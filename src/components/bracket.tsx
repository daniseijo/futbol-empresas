"use client";

import Link from "next/link";
import { useState } from "react";
import { Crest } from "@/components/crest";
import { formatShortDate } from "@/lib/dates";
import type { BracketData, BracketTie } from "@/lib/views/competition";

interface Props {
  bracket: BracketData;
  logos: Record<number, string | null>;
  focusTeamId: number | null;
  now: string;
}

/**
 * A knockout bracket: one column per round with lines joining each pair of
 * ties to the one they feed (large screens), or one round at a time behind
 * tabs (phones and tablets).
 */
export function Bracket(props: Props) {
  return (
    <>
      <RoundTabs {...props} />
      <Columns {...props} />
    </>
  );
}

function RoundTabs({ bracket, logos, focusTeamId, now }: Props) {
  const [selected, setSelected] = useState(bracket.currentRound);
  const round = bracket.rounds[selected];
  return (
    <div className="flex flex-col gap-3 lg:hidden">
      <div role="tablist" aria-label="Rondas" className="flex gap-1.5 overflow-x-auto pb-1">
        {bracket.rounds.map((r, index) => {
          const active = index === selected;
          return (
            <button
              key={r.name}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelected(index)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[13px] ${
                active ? "border-accent bg-accent font-semibold text-on-accent" : "border-line bg-canvas hover:border-ink"
              }`}
            >
              {r.name}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" aria-label={round.name} className="flex flex-col gap-2">
        {round.ties.map((tie, index) => (
          // A gap after each pair: the two ties that feed the same one of the next round.
          <div key={tie.id} className={index % 2 === 1 && index < round.ties.length - 1 ? "mb-2" : ""}>
            <TieCard tie={tie} round={round.name} logos={logos} focusTeamId={focusTeamId} now={now} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Half of the gap between columns: each side of a connecting line. */
const STUB = "1rem";

function Columns({ bracket, logos, focusTeamId, now }: Props) {
  const last = bracket.rounds.length - 1;
  return (
    <div className="hidden overflow-x-auto lg:block">
      <div
        className="grid min-w-[860px] gap-x-8"
        style={{
          gridTemplateColumns: `repeat(${bracket.rounds.length}, minmax(0, 1fr))`,
        }}
      >
        {bracket.rounds.map((round) => (
          <h3 key={round.name} className="pb-2 text-center text-xs font-semibold tracking-wide text-muted uppercase">
            {round.name}
          </h3>
        ))}
        {bracket.rounds.map((round, r) => {
          const slots = round.ties.map((tie) => (
            <div key={tie.id} className="relative flex flex-1 items-center py-1.5">
              {r > 0 && (
                <span aria-hidden="true" className="absolute top-1/2 border-t border-line" style={{ left: `-${STUB}`, width: STUB }} />
              )}
              <div className="w-full">
                <TieCard tie={tie} round={round.name} logos={logos} focusTeamId={focusTeamId} now={now} />
              </div>
            </div>
          ));
          if (r === last) {
            return (
              <div key={round.name} className="flex flex-col">
                {slots}
              </div>
            );
          }
          const pairs = [];
          for (let i = 0; i < slots.length; i += 2) {
            pairs.push(
              <div key={i} className="relative flex flex-1 flex-col">
                {slots.slice(i, i + 2)}
                <span
                  aria-hidden="true"
                  className="absolute top-1/4 bottom-1/4 rounded-r-md border-y border-r border-line"
                  style={{ right: `-${STUB}`, width: STUB }}
                />
              </div>,
            );
          }
          return (
            <div key={round.name} className="flex flex-col">
              {pairs}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TieCard({
  tie,
  round,
  logos,
  focusTeamId,
  now,
}: {
  tie: BracketTie;
  round: string;
  logos: Props["logos"];
  focusTeamId: number | null;
  now: string;
}) {
  const focus = focusTeamId !== null && (tie.homeId === focusTeamId || tie.awayId === focusTeamId);
  const sides = [
    { id: tie.homeId, name: tie.homeName, goals: tie.homeGoals },
    { id: tie.awayId, name: tie.awayName, goals: tie.awayGoals },
  ];
  const winner = sides.find((side) => side.id === tie.winnerId);
  const label = tie.played
    ? `${round}: ${tie.homeName} ${tie.homeGoals}, ${tie.awayName} ${tie.awayGoals}.${winner ? ` Pasa ${winner.name}.` : ""}`
    : `${round}: ${tie.homeName} contra ${tie.awayName}, ${formatShortDate(tie.date, now)}.`;
  return (
    <Link
      href={`/partidos/${tie.id}`}
      aria-label={label}
      className={`flex flex-col gap-1 rounded-xl border px-2.5 py-2 ${
        focus ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-ink"
      }`}
    >
      {sides.map((side) => {
        const won = side.id === tie.winnerId;
        const lost = tie.winnerId !== null && !won;
        return (
          <span key={side.id} className={`grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-2 text-sm ${lost ? "text-muted" : ""}`}>
            <Crest src={logos[side.id]} name={side.name} size={20} />
            <span className={`truncate ${won ? "font-bold" : ""}`}>{side.name}</span>
            <span className={`font-display text-lg leading-none font-extrabold ${won ? "" : "opacity-80"}`}>
              {tie.played ? side.goals : ""}
            </span>
          </span>
        );
      })}
      {!tie.played && <span className="text-xs text-muted">{formatShortDate(tie.date, now)}</span>}
    </Link>
  );
}
