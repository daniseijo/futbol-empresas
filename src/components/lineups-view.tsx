"use client";

import { useSyncExternalStore } from "react";

type View = "lista" | "campo";

const KEY = "alineaciones";
const listeners = new Set<() => void>();
/** The choice made in this tab, in case the browser does not let us store it. */
let chosen: View | null = null;

function read(): View {
  if (chosen) return chosen;
  try {
    return localStorage.getItem(KEY) === "campo" ? "campo" : "lista";
  } catch {
    return "lista";
  }
}

function choose(view: View) {
  chosen = view;
  try {
    localStorage.setItem(KEY, view);
  } catch {
    // Private mode or blocked storage: the choice lasts until the page is reloaded.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The lineups view the visitor picked ("Lista" until they pick), shared by the toggle and both panes. */
function useView(): View {
  return useSyncExternalStore(subscribe, read, () => "lista");
}

/** "Lista · Campo" above the lineups: a radio group, so arrows move between the two. */
export function LineupsToggle() {
  const view = useView();
  return (
    <fieldset className="flex shrink-0 rounded-full border border-line bg-canvas p-0.5 text-[13px]">
      <legend className="sr-only">Ver las alineaciones como</legend>
      {(["lista", "campo"] as const).map((option) => (
        <label
          key={option}
          className={`cursor-pointer rounded-full px-3 py-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-text ${
            view === option ? "bg-surface font-semibold shadow-[0_0_0_1px_var(--color-line)]" : "text-muted hover:text-ink"
          }`}
        >
          <input
            type="radio"
            name="alineaciones"
            value={option}
            checked={view === option}
            onChange={() => choose(option)}
            className="sr-only"
          />
          {option === "lista" ? "Lista" : "Campo"}
        </label>
      ))}
    </fieldset>
  );
}

/** Shows its children only in the chosen view. */
export function LineupsPane({ view, children }: { view: View; children: React.ReactNode }) {
  return <div hidden={useView() !== view}>{children}</div>;
}
