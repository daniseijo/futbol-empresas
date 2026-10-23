"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

/**
 * A still map around the venue, styled like the site (src/lib/map-style.ts). It is decorative:
 * directions are on "Cómo llegar". MapLibre loads only in the browser, after the page; without
 * WebGL the placeholder (the marker on the canvas colour) stays.
 */
export function VenueMap({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const container = useRef<HTMLDivElement>(null);

  // Next.js hides the previous page (React <Activity>) instead of unmounting it: the map is removed
  // when hidden, freeing its WebGL context, and built again when shown.
  useEffect(() => {
    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;
    Promise.all([import("maplibre-gl"), import("@/lib/map-style")])
      .then(([{ Map, Marker }, { mapStyle }]) => {
        if (cancelled || !container.current) return;
        map = new Map({
          container: container.current,
          style: mapStyle,
          center: [lng, lat],
          zoom: 15.6,
          interactive: false,
          attributionControl: { compact: true },
        });
        new Marker({ element: pin() }).setLngLat([lng, lat]).addTo(map);
        // The compact attribution opens on load; keep it folded behind its ⓘ button.
        map.once("load", () => container.current?.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show"));
      })
      .catch(() => {
        // No WebGL or the tiles failed: the placeholder stays.
      });
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lng]);

  return (
    <div
      role="img"
      aria-label={`Mapa de ${name}`}
      className="relative h-[280px] overflow-hidden rounded-[22px] border border-line bg-canvas"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
        <Pin />
      </div>
      {/* MapLibre makes its container position: relative, so it is sized, not inset. */}
      <div ref={container} className="size-full" />
    </div>
  );
}

const PIN_CLASSES = {
  halo: "flex size-11 items-center justify-center rounded-full bg-accent/20",
  dot: "size-4.5 rounded-full border-[3px] border-white bg-accent shadow-[0_2px_6px_rgba(11,15,20,0.3)]",
};

function Pin() {
  return (
    <span className={PIN_CLASSES.halo}>
      <span className={PIN_CLASSES.dot} />
    </span>
  );
}

/** The same pin as a DOM element, for MapLibre's marker. */
function pin(): HTMLElement {
  const halo = document.createElement("span");
  halo.className = PIN_CLASSES.halo;
  const dot = document.createElement("span");
  dot.className = PIN_CLASSES.dot;
  halo.append(dot);
  return halo;
}
