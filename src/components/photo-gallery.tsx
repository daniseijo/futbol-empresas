"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";

export interface GalleryPhoto {
  url: string;
  /** Shown over the photo in the viewer; empty for none. */
  caption: string;
}

/**
 * Photos as a grid; tapping one opens it full size in a dialog, with arrows (and
 * swipe, and the keyboard) to go through all of them and a download button. The
 * grid can show only the first few (`shown`): the viewer still goes through all.
 */
export function PhotoGallery({
  photos,
  alt,
  fileName,
  shown = photos.length,
  className,
  tileClassName,
  sizes,
  featureFirst = false,
}: {
  photos: GalleryPhoto[];
  /** Alt text for photos without a caption. */
  alt: string;
  /** Downloads are named `${fileName}-${n}.jpg`. */
  fileName: string;
  shown?: number;
  /** The grid's classes. */
  className: string;
  tileClassName: string;
  sizes: string;
  /** The first tile spans two rows from `sm` and carries its caption. */
  featureFirst?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const touchX = useRef<number | null>(null);

  // The page stays mounted but hidden after navigating away, and a modal dialog
  // keeps the rest of the document inert: close it then.
  useLayoutEffect(() => () => dialog.current?.close(), []);

  const photo = photos[index];
  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;
  // No wrapping around: the arrows go away at either end.
  function go(step: number) {
    const next = Math.min(Math.max(index + step, 0), photos.length - 1);
    setIndex(next);
    // The arrow that had the focus is gone at an end: give it to the dialog, so the keys keep working.
    if (next === 0 || next === photos.length - 1) dialog.current?.focus();
  }

  function open(i: number) {
    setIndex(i);
    dialog.current?.showModal();
  }

  async function download() {
    setDownloading(true);
    try {
      // A cross-origin link ignores `download`, so go through a blob (Flickr allows CORS).
      const blob = await (await fetch(photo.url)).blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = photos.length > 1 ? `${fileName}-${index + 1}.jpg` : `${fileName}.jpg`;
      a.click();
      URL.revokeObjectURL(href);
    } catch {
      window.open(photo.url, "_blank", "noopener");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <div className={className}>
        {photos.slice(0, shown).map((p, i) => (
          <button
            key={p.url}
            type="button"
            onClick={() => open(i)}
            aria-label={`Ampliar foto ${i + 1} de ${photos.length}`}
            className={`group relative cursor-zoom-in overflow-hidden ${tileClassName} ${featureFirst && i === 0 ? "sm:row-span-2" : ""}`}
          >
            <Image src={p.url} alt={p.caption || alt} fill sizes={sizes} className="object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
            {featureFirst && i === 0 && p.caption && (
              <span className="absolute bottom-3 left-3 rounded-lg bg-white/90 px-2.5 py-1.5 text-[13px] font-semibold">{p.caption}</span>
            )}
          </button>
        ))}
      </div>

      <dialog
        ref={dialog}
        tabIndex={-1}
        aria-label={alt}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") go(-1);
          if (e.key === "ArrowRight") go(1);
        }}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
        className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-white outline-none backdrop:bg-[rgba(11,15,20,0.97)] open:flex open:flex-col"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="flex min-w-0 items-baseline gap-3">
            {photos.length > 1 && (
              <span className="shrink-0 font-display text-lg font-extrabold tabular-nums">
                {index + 1} / {photos.length}
              </span>
            )}
            {photo?.caption && <span className="truncate text-sm text-white/75">{photo.caption}</span>}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={download}
              disabled={downloading}
              aria-label={downloading ? "Descargando…" : "Descargar"}
              title="Descargar"
              className="flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:animate-pulse"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3.5V15" />
                <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
                <path d="M5 19.5h14" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Cerrar"
              className="flex size-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1" onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}>
          {photo && (
            /* A plain img: the dialog sizes it to the screen, whatever the photo's shape. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={photo.url}
              src={photo.url}
              alt={photo.caption || alt}
              className="pointer-events-none absolute inset-0 m-auto max-h-full max-w-full object-contain px-2 select-none sm:px-20"
            />
          )}
          {hasPrev && <Arrow direction="left" onClick={() => go(-1)} />}
          {hasNext && <Arrow direction="right" onClick={() => go(1)} />}
        </div>
        <div className="h-4 shrink-0 sm:h-6" />
      </dialog>
    </>
  );
}

function Arrow({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "left" ? "Foto anterior" : "Foto siguiente"}
      className={`absolute top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 hover:bg-black/60 ${
        direction === "left" ? "left-3 sm:left-5" : "right-3 sm:right-5"
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={direction === "left" ? "m14.5 5.5-6.5 6.5 6.5 6.5" : "m9.5 5.5 6.5 6.5-6.5 6.5"} />
      </svg>
    </button>
  );
}
