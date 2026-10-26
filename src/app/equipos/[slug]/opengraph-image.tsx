import { crestDataUrl, OG, OG_SIZE, OgCrest, OgFrame, ogImage } from "@/lib/og";
import type { Outcome } from "@/lib/sportspress/types";
import { outcomeFor } from "@/lib/standings";
import { fitPixelSize } from "@/lib/text";
import { getTeamPageData, teamSummary } from "@/lib/views/team";
import DefaultImage from "../../opengraph-image";

export const alt = "Escudo y clasificación del equipo";
export const size = OG_SIZE;
export const contentType = "image/png";

// The same teams as the page are generated at build time and the rest on first request, then cached and
// revalidated like the page; without a list the image would be drawn again on every request.
export { generateStaticParams } from "./layout";

const OUTCOME_STYLE: Record<Outcome, { background: string; color: string }> = {
  V: { background: OG.ink, color: OG.surface },
  E: { background: OG.lineSoft, color: OG.ink },
  D: { background: OG.lossSoft, color: OG.loss },
};

/** The shared link's image for every tab of a team: crest, name, position and recent form. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getTeamPageData(slug);
  if (!data) return DefaultImage();
  const { team, row, standings } = data;
  const crest = await crestDataUrl(team.logoUrl);
  // Oldest first, as the site's form badges read.
  const form = data.lastResults
    .slice(0, 5)
    .map((m) => outcomeFor(m, team.id))
    .filter((o) => o !== null)
    .reverse();

  return ogImage(
    <OgFrame>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 56 }}>
        <OgCrest src={crest} name={team.name} size={260} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          <div style={{ fontSize: 28, color: OG.accentText, fontWeight: 700 }}>{teamSummary(data)}</div>
          <div style={{ fontFamily: "Barlow", fontSize: fitPixelSize(team.name, { width: 772, base: 110, min: 56, maxLines: 3, emPerChar: 0.46 }), lineHeight: 0.9, textTransform: "uppercase", color: OG.ink }}>
            {team.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {row && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: "Barlow", fontSize: 72, color: OG.accentText }}>{row.position}º</span>
                <span style={{ fontSize: 26, color: OG.muted }}>
                  de {standings.length} · {row.points} {row.points === 1 ? "punto" : "puntos"}
                </span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              {form.map((outcome, index) => (
                <div
                  key={index}
                  style={{
                    ...OUTCOME_STYLE[outcome],
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    fontWeight: 700,
                  }}
                >
                  {outcome}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </OgFrame>,
  );
}
