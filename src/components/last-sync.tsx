"use client";

import { useSyncExternalStore } from "react";
import { formatShortDate, formatTime, minutesBetween, nowInMadrid } from "@/lib/dates";

// La hora de Madrid al minuto: el texto relativo se recalcula una vez por minuto.
// En el servidor y al hidratar no hay "ahora", así que se pinta la hora exacta.
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

/** «Datos actualizados hace 12 min»: cuándo trajo cambios de la API la última sincronización. */
export function LastSync({ stamp }: { stamp: string }) {
  const now = useSyncExternalStore(subscribe, getNow, getServerNow);
  return (
    <span title={`Última sincronización: ${absolute(stamp)}`}>
      Datos actualizados <time dateTime={stamp}>{now ? relative(minutesBetween(stamp, now), stamp) : absolute(stamp)}</time>.
    </span>
  );
}
