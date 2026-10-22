"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState } from "react";
import { Crest } from "./crest";

export interface SearchableTeam {
  slug: string;
  name: string;
  logoUrl: string | null;
  active: boolean;
}

const MAX_RESULTS = 8;

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Buscador de empresas. La lista completa llega del servidor (≈325 equipos). */
export function TeamSearch({ teams }: { teams: SearchableTeam[] }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const results = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return [];
    return teams
      .filter((team) => normalize(team.name).includes(q))
      .sort((a, b) => Number(normalize(b.name).startsWith(q)) - Number(normalize(a.name).startsWith(q)) || Number(b.active) - Number(a.active))
      .slice(0, MAX_RESULTS);
  }, [query, teams]);

  const go = (team: SearchableTeam) => {
    setOpen(false);
    setQuery("");
    router.push(`/equipos/${team.slug}`);
  };

  const showList = open && query.trim().length > 0;

  return (
    <div className="relative w-full sm:w-72">
      <label className="flex h-11 items-center gap-2 rounded-[10px] border border-line bg-canvas px-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <span className="sr-only">Buscar empresa</span>
        <input
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && results[highlight] ? `${listId}-${highlight}` : undefined}
          placeholder="Busca tu empresa"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlight(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
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
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
        />
      </label>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute right-0 left-0 z-20 mt-1.5 overflow-hidden rounded-xl border border-line bg-surface p-1.5 shadow-lg"
        >
          {results.length === 0 && <li className="px-2.5 py-2 text-sm text-muted">Ninguna empresa coincide</li>}
          {results.map((team, index) => (
            <li
              key={team.slug}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === highlight}
              onMouseDown={(event) => {
                event.preventDefault();
                go(team);
              }}
              onMouseEnter={() => setHighlight(index)}
              className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 ${index === highlight ? "bg-line-soft" : ""}`}
            >
              <Crest src={team.logoUrl} name={team.name} size={28} />
              <span className="flex-1 text-sm font-medium">{team.name}</span>
              {!team.active && <span className="text-[11px] font-semibold text-muted">Sin equipo esta temporada</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
