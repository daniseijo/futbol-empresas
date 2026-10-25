"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Shares the current page: the phone's share sheet where the browser has one,
 * otherwise copies the link and says so for a moment.
 */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // The page stays mounted but hidden after navigating away: stop the timer then.
  useLayoutEffect(() => () => clearTimeout(timer.current), []);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // Closing the share sheet rejects too: nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={copied ? "Enlace copiado" : "Compartir"}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold hover:border-ink"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {copied ? (
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        ) : (
          <>
            <path d="M12 15V3.5" />
            <path d="m7.5 8 4.5-4.5L16.5 8" />
            <path d="M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" />
          </>
        )}
      </svg>
      {copied ? "Enlace copiado" : "Compartir"}
    </button>
  );
}
