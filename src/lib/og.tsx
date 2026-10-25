import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cacheLife } from "next/cache";
import { ImageResponse } from "next/og";
import { initials } from "@/components/crest";
import { siteConfig } from "@/config/site";

/**
 * Shared pieces of the images shown when a link is shared (opengraph-image.tsx
 * files). They are drawn by Satori, which cannot read CSS variables: the
 * colours below mirror the tokens in src/app/globals.css.
 */
export const OG_SIZE = { width: 1200, height: 630 };

export const OG = {
  surface: "#ffffff",
  line: "#e3e6eb",
  lineSoft: "#eef0f3",
  ink: "#0b0f14",
  muted: "#525c6b",
  accent: "#f0533b",
  accentText: "#c2321e",
  accentSoft: "#fde9e5",
  loss: "#b42318",
  lossSoft: "#fdecea",
};

// Latin subsets of the site's fonts (Satori needs TTF, not the woff2 next/font serves).
const fontDir = join(process.cwd(), "src/assets/fonts");
const fonts = Promise.all([
  readFile(join(fontDir, "Inter-Medium.ttf")),
  readFile(join(fontDir, "Inter-Bold.ttf")),
  readFile(join(fontDir, "BarlowCondensed-ExtraBold.ttf")),
]);

export async function ogImage(element: React.ReactElement): Promise<ImageResponse> {
  const [interMedium, interBold, barlow] = await fonts;
  return new ImageResponse(element, {
    ...OG_SIZE,
    fonts: [
      { name: "Inter", data: interMedium, weight: 500, style: "normal" },
      { name: "Inter", data: interBold, weight: 700, style: "normal" },
      { name: "Barlow", data: barlow, weight: 800, style: "normal" },
    ],
  });
}

/**
 * A crest as a data URL, or null when it cannot be fetched. Crests live on the
 * league's WordPress, which is slow or down at times: a missing crest falls
 * back to initials instead of failing the whole image.
 */
export async function crestDataUrl(url: string | null): Promise<string | null> {
  "use cache";
  cacheLife("catalog");
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const type = response.headers.get("content-type") ?? "";
    // Satori draws PNG and JPEG; anything else (WebP, an HTML error page) gets the initials.
    if (!response.ok || !/^image\/(png|jpe?g)/.test(type)) return null;
    const data = Buffer.from(await response.arrayBuffer()).toString("base64");
    return `data:${type};base64,${data}`;
  } catch {
    return null;
  }
}

/** A crest on a white tile, or the team's initials in the same shape. */
export function OgCrest({ src, name, size }: { src: string | null; name: string; size: number }) {
  const tile = {
    width: size,
    height: size,
    borderRadius: Math.round(size * 0.24),
    border: `2px solid ${OG.line}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  };
  if (!src) {
    return <div style={{ ...tile, background: OG.lineSoft, color: OG.muted, fontFamily: "Barlow", fontSize: size * 0.38 }}>{initials(name)}</div>;
  }
  return (
    <div style={{ ...tile, background: OG.surface }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori only draws plain <img>. */}
      <img src={src} alt="" width={size * 0.8} height={size * 0.8} style={{ objectFit: "contain" }} />
    </div>
  );
}

/** The site's logo square and name, as in the header. */
export function OgBrand({ size = 44 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.3 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.25,
          background: OG.accent,
          color: OG.ink,
          fontFamily: "Barlow",
          fontSize: size * 0.53,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        FE
      </div>
      <div style={{ fontFamily: "Barlow", fontSize: size * 0.6, letterSpacing: 1.5, color: OG.ink }}>{siteConfig.name.toUpperCase()}</div>
    </div>
  );
}

/** White card with the brand at the top and a coral strip at the bottom. */
export function OgFrame({ aside, children }: { aside?: string; children: React.ReactNode }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: OG.surface, fontFamily: "Inter" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 32, padding: "40px 56px 0" }}>
        <OgBrand />
        {aside && <div style={{ fontSize: 26, color: OG.muted, maxWidth: 720, textAlign: "right" }}>{aside}</div>}
      </div>
      <div style={{ flex: 1, display: "flex", padding: "0 56px" }}>{children}</div>
      <div style={{ height: 14, background: OG.accent }} />
    </div>
  );
}
