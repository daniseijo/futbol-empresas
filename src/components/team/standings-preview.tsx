"use client";

import { useState } from "react";
import type { StandingRow } from "@/lib/sportspress/types";
import { StandingsZone } from "./standings-table";

/** Rows shown before "Mostrar más": the ones around the team. */
const PREVIEW_SIZE = 7;

/**
 * The standings beside the featured match: the rows around the team, and all of them on demand, so a
 * 14-team group does not stretch the card. `logos` and `slugs` only need the group's teams.
 */
export function StandingsPreview({
  rows,
  teamId,
  logos,
  slugs,
}: {
  rows: StandingRow[];
  teamId: number;
  logos: Record<number, string | null>;
  slugs: Record<number, string>;
}) {
  const [expanded, setExpanded] = useState(false);
  // One hidden row is not worth a button.
  const collapsible = rows.length > PREVIEW_SIZE + 1;
  return (
    <div className="flex flex-col gap-1">
      <StandingsZone rows={rows} teamId={teamId} logos={logos} slugs={slugs} size={collapsible && !expanded ? PREVIEW_SIZE : rows.length} />
      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          className="self-start px-1.5 py-1 text-[13px] font-semibold text-accent-text hover:underline"
        >
          {expanded ? "Mostrar menos" : `Mostrar los ${rows.length}`}
        </button>
      )}
    </div>
  );
}
