"use client";

import { useSyncExternalStore } from "react";
import { formatShortDate, formatTime, minutesBetween, nowInMadrid } from "@/lib/dates";

// Madrid time to the minute: the relative text is recomputed once a minute.
// On the server and during hydration there is no "now", so the exact time is shown.
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}
const getNow = () => nowInMadrid();
const getServerNow = () => null;

function relative(minutes: number, stamp: string): string {
  if (minutes < 1) return "ahora mismo";
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 24 * 60) return `hace ${Math.floor(minutes / 60)} h`;
  return absolute(stamp);
}

function absolute(stamp: string): string {
  return `el ${formatShortDate(stamp).toLowerCase()} a las ${formatTime(stamp)}`;
}

/** "Datos actualizados hace 12 min": when the last sync pulled changes from the API. */
export function LastSync({ stamp }: { stamp: string }) {
  const now = useSyncExternalStore(subscribe, getNow, getServerNow);
  return (
    <span title={`Última sincronización: ${absolute(stamp)}`}>
      Datos actualizados <time dateTime={stamp}>{now ? relative(minutesBetween(stamp, now), stamp) : absolute(stamp)}</time>.
    </span>
  );
}
