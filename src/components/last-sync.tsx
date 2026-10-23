"use client";

import { useSyncExternalStore } from "react";
import { siteConfig } from "@/config/site";
import { formatShortDate, formatTime, minutesBetween, nowInMadrid } from "@/lib/dates";

// Madrid time to the minute: the relative text is recomputed once a minute.
// The footer is part of the static shell, so the server has no "now" and renders the exact time;
// the inline script below swaps in the relative text before the browser paints it.
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}
const getNow = () => nowInMadrid();
const getServerNow = () => null;

// The sync runs at least every 3 hours, so older data means it has stopped.
const STALE_MINUTES = 12 * 60;

function relative(minutes: number, stamp: string): string {
  if (minutes < 1) return "ahora mismo";
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 24 * 60) return `hace ${Math.floor(minutes / 60)} h`;
  return absolute(stamp);
}

function absolute(stamp: string): string {
  return `el ${formatShortDate(stamp).toLowerCase()} a las ${formatTime(stamp)}`;
}

// Runs as soon as the browser parses the footer, before it is painted, so the exact time never flashes.
// Hydration renders the server's text (the mismatch is suppressed) and the client render then writes
// the same text the script did. Keep it in step with relative() and STALE_MINUTES.
function inlineScript(stamp: string): string {
  const zone = JSON.stringify(siteConfig.timeZone);
  const from = JSON.stringify(`${stamp.slice(0, 16)}:00Z`);
  return `(()=>{const s=document.currentScript.previousElementSibling,t=s.querySelector("time"),p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:${zone},year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts().map(x=>[x.type,x.value])),m=Math.round((Date.parse(p.year+"-"+p.month+"-"+p.day+"T"+p.hour+":"+p.minute+":00Z")-Date.parse(${from}))/6e4);if(m<${24 * 60})t.textContent=m<1?"ahora mismo":m<60?"hace "+m+" min":"hace "+Math.floor(m/60)+" h";if(m>${STALE_MINUTES})s.classList.add("text-loss")})()`;
}

/** "Datos actualizados hace 12 min": when the last sync pulled changes from the API. */
export function LastSync({ stamp }: { stamp: string }) {
  const now = useSyncExternalStore(subscribe, getNow, getServerNow);
  const minutes = now ? minutesBetween(stamp, now) : 0;
  return (
    <>
      <span
        title={`Última sincronización: ${absolute(stamp)}`}
        className={minutes > STALE_MINUTES ? "text-loss" : undefined}
        suppressHydrationWarning
      >
        Datos actualizados{" "}
        <time dateTime={stamp} suppressHydrationWarning>
          {now ? relative(minutes, stamp) : absolute(stamp)}
        </time>
        .
      </span>
      <script dangerouslySetInnerHTML={{ __html: inlineScript(stamp) }} />
    </>
  );
}
