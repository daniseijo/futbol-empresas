"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { normalize } from "@/lib/search";
import { Crest } from "./crest";

export interface PickerTeam {
  slug: string;
  name: string;
  logoUrl: string | null;
}

const MAX_RESULTS = 6;

/**
 * The team search on the Slack bot's page: this season's teams, filtered as
 * you type, each a link to /slack/nuevo. The list comes with the page (a few
 * KB), so it needs neither the header's search index nor the database.
 */
export function SlackTeamPicker({ teams }: { teams: PickerTeam[] }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const keys = useMemo(() => teams.map((team) => ` ${normalize(team.name)}`), [teams]);
  const q = normalize(query);
  const results = q
    ? teams
        .map((team, i) => ({ team, rank: keys[i].startsWith(` ${q}`) ? 0 : keys[i].includes(` ${q}`) ? 1 : keys[i].includes(q) ? 2 : null }))
        .filter((hit) => hit.rank !== null)
        .sort((a, b) => a.rank! - b.rank!)
        .slice(0, MAX_RESULTS)
        .map((hit) => hit.team)
    : [];

  return (
    <div className="flex w-full flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        Tu equipo
      </label>
      <input
        id={id}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Busca tu empresa"
        autoComplete="off"
        aria-describedby={`${id}-status`}
        // 16px on phones: iOS Safari zooms into smaller fields when they get focus.
        className="h-11 w-full rounded-[10px] border border-line bg-canvas px-3 text-base placeholder:text-muted sm:text-sm"
      />
      <p id={`${id}-status`} role="status" className="sr-only">
        {q ? (results.length === 0 ? "Ningún equipo coincide" : `${results.length} equipos`) : ""}
      </p>
      {q && results.length === 0 && <p className="text-sm text-muted">Ningún equipo de esta temporada coincide.</p>}
      {results.length > 0 && (
        <ul className="flex flex-col">
          {results.map((team) => (
            <li key={team.slug} className="border-t border-line-soft first:border-t-0">
              <Link href={`/slack/nuevo?equipo=${encodeURIComponent(team.slug)}`} className="flex items-center gap-2.5 rounded-lg px-1.5 py-2 hover:bg-line-soft">
                <Crest src={team.logoUrl} name={team.name} size={28} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{team.name}</span>
                <span aria-hidden="true" className="text-muted">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
