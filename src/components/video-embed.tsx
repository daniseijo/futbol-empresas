"use client";

import Image from "next/image";
import { useLayoutEffect, useState } from "react";

/**
 * YouTube video that only loads the player on play: until then it is a
 * thumbnail, so the page does not carry YouTube's weight.
 */
export function VideoEmbed({ id, title, label = "Resumen" }: { id: string; title: string; label?: string }) {
  const [playing, setPlaying] = useState(false);
  // Not every video has a max-resolution thumbnail.
  const [thumbnail, setThumbnail] = useState(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);

  // Next.js hides the previous page (React <Activity>) instead of unmounting it, and a hidden
  // YouTube iframe keeps playing over the next page. Back to the thumbnail when hidden.
  useLayoutEffect(() => () => setPlaying(false), []);

  return (
    <div className="relative aspect-video overflow-hidden rounded-[22px] bg-ink">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 text-left" aria-label={`Ver vídeo: ${title}`}>
          <Image
            src={thumbnail}
            alt=""
            fill
            sizes="(min-width: 1024px) 60vw, 100vw"
            onError={() => setThumbnail(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`)}
            className="object-cover opacity-85 transition-opacity group-hover:opacity-100"
          />
          <span className="absolute inset-0 bg-[linear-gradient(0deg,rgba(11,15,20,0.85)_0%,rgba(11,15,20,0)_55%)]" />
          <span className="absolute top-1/2 left-1/2 flex size-18 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent shadow-lg transition-transform group-hover:scale-105">
            <svg width="26" height="26" viewBox="0 0 24 24" className="ml-1 fill-on-accent" aria-hidden="true">
              <path d="M7 4l13 8-13 8z" />
            </svg>
          </span>
          <span className="absolute right-5 bottom-5 left-5 flex flex-col gap-1.5 text-white">
            <span className="self-start rounded-md bg-accent px-2 py-0.5 text-[11px] font-extrabold tracking-[0.1em] text-on-accent uppercase">
              {label}
            </span>
            <span className="font-display text-2xl leading-tight font-extrabold sm:text-3xl">{title}</span>
          </span>
        </button>
      )}
    </div>
  );
}
