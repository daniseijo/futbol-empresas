"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { decodeIndex, search, type PlayerResult, type SearchIndex, type SearchIndexPayload, type TeamResult } from "@/lib/search";
import { Crest } from "./crest";
import { PlayerAvatar } from "./player-avatar";

type Result = { kind: "team"; team: TeamResult; href: string } | { kind: "player"; player: PlayerResult; href: string };

// One download per page load, shared by every navigation (the header never unmounts).
let indexPromise: Promise<SearchIndex> | null = null;

function loadIndex(): Promise<SearchIndex> {
  indexPromise ??= fetch("/api/busqueda")
    .then((res) => {
      if (!res.ok) throw new Error(`Search index: ${res.status}`);
      return res.json() as Promise<SearchIndexPayload>;
    })
    .then(decodeIndex)
    .catch((error: unknown) => {
      indexPromise = null; // try again on the next focus
      throw error;
    });
  return indexPromise;
}

/**
 * Company and player search. The index (≈325 teams and ≈7,000 players) is
 * downloaded the first time the box is hovered or focused, and searched in the
 * browser: see src/lib/search.ts.
 */
export function SiteSearch() {
  const router = useRouter();
  const listId = useId();
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const prepare = () => {
    if (index) return;
    setFailed(false);
    loadIndex().then(setIndex, () => setFailed(true));
  };

  const { teams, players } = useMemo(() => (index ? search(index, query) : { teams: [], players: [] }), [index, query]);
  // One list for the keyboard, in the order they are shown.
  const results: Result[] = [
    ...teams.map((team): Result => ({ kind: "team", team, href: `/equipos/${team.slug}` })),
    ...players.map((player): Result => ({ kind: "player", player, href: `/jugadores/${player.id}` })),
  ];

  const go = (result: Result) => {
    setOpen(false);
    setQuery("");
    router.push(result.href);
  };

  const showList = open && query.trim().length > 0;
  const status = failed ? "No se pudo cargar la búsqueda" : !index ? "Buscando…" : results.length === 0 ? "Ningún equipo ni jugador coincide" : null;

  const option = (result: Result, i: number) => (
    <li
      key={result.href}
      id={`${listId}-${i}`}
      role="option"
      aria-selected={i === highlight}
      onMouseDown={(event) => {
        event.preventDefault();
        go(result);
      }}
      onMouseEnter={() => setHighlight(i)}
      className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 ${i === highlight ? "bg-line-soft" : ""}`}
    >
      {result.kind === "team" ? (
        <>
          <Crest src={result.team.logoUrl} name={result.team.name} size={28} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{result.team.name}</span>
            {!result.team.active && <span className="truncate text-xs text-muted">Sin equipo esta temporada</span>}
          </span>
        </>
      ) : (
        <>
          <PlayerAvatar name={result.player.name} photoUrl={result.player.photoUrl} number={null} position={null} size={28} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{result.player.name}</span>
            {result.player.team && <span className="truncate text-xs text-muted">{result.player.team}</span>}
          </span>
        </>
      )}
    </li>
  );

  const group = (label: string, items: Result[], offset: number) =>
    items.length > 0 && (
      <ul role="group" aria-labelledby={`${listId}-${label}`}>
        <li id={`${listId}-${label}`} role="presentation" className="px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
          {label}
        </li>
        {items.map((result, i) => option(result, offset + i))}
      </ul>
    );

  return (
    // On phones the results drop below the whole header row, not just the narrow field.
    <div className="min-w-0 flex-1 sm:relative sm:w-72 sm:flex-none" onPointerEnter={prepare}>
      <label className="flex h-11 items-center gap-1.5 rounded-[10px] border border-line bg-canvas px-2.5 focus-within:border-muted sm:gap-2 sm:px-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <span className="sr-only">Buscar empresa o jugador</span>
        <input
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[highlight] ? `${listId}-${highlight}` : undefined}
          placeholder="Buscar empresa o jugador"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={() => {
            prepare();
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlight((h) => Math.min(h + 1, results.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlight((h) => Math.max(h - 1, 0));
            } else if (event.key === "Enter" && results[highlight]) {
              event.preventDefault();
              go(results[highlight]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          // 16px on phones: iOS Safari zooms into smaller fields when they get focus. The field's own
          // outline is off (it needs `!` to beat the global :focus-visible ring); the box's border shows focus.
          className="w-full bg-transparent text-base outline-none! placeholder:text-muted sm:text-sm"
        />
      </label>
      {showList && (
        <div
          id={listId}
          role="listbox"
          aria-busy={!index && !failed}
          className="absolute inset-x-4 z-20 mt-1.5 sm:inset-x-0 max-h-[min(70vh,32rem)] overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-lg"
        >
          {status ? (
            <p role="status" className="px-2.5 py-2 text-sm text-muted">
              {status}
            </p>
          ) : (
            <>
              {group("Equipos", results.slice(0, teams.length), 0)}
              {group("Jugadores", results.slice(teams.length), teams.length)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
