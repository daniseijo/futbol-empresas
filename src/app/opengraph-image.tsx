import { siteConfig } from "@/config/site";
import { OG, OG_SIZE, OgBrand, ogImage } from "@/lib/og";

export const alt = siteConfig.name;
export const size = OG_SIZE;
export const contentType = "image/png";

/** The image for every page without one of its own. */
export default function Image() {
  return ogImage(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: OG.surface, fontFamily: "Inter" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 36, padding: "0 80px" }}>
        <OgBrand size={96} />
        <div style={{ fontSize: 40, lineHeight: 1.3, color: OG.muted, maxWidth: 900 }}>{siteConfig.description}</div>
      </div>
      <div style={{ height: 14, background: OG.accent }} />
    </div>,
  );
}
