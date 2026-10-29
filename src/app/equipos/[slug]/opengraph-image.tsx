import { championsRibbon, crestDataUrl, OG, OG_CHAMPIONS, OG_SIZE, OgCrest, OgFrame, ogImage } from "@/lib/og";
import type { Outcome } from "@/lib/sportspress/types";
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
/** On the Champions night: a win in white, a draw faint. */
const CHAMPIONS_OUTCOME_STYLE: Record<Outcome, { background: string; color: string }> = {
  ...OUTCOME_STYLE,
  V: { background: OG_CHAMPIONS.ink, color: OG_CHAMPIONS.deep },
  E: { background: OG_CHAMPIONS.pill, color: OG_CHAMPIONS.pillText },
};

/** The shared link's image for every tab of a team: crest, name, position and recent form. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getTeamPageData(slug);
  if (!data) return DefaultImage();
  const { team, row, standings } = data;
  const crest = await crestDataUrl(team.logoUrl);
  // The group's own form, like the position beside it (a Champions week starts it again); oldest first.
  const form = (row?.form ?? []).slice(-5);
  // In a Champions week the header follows the Champions match, and so does the image.
  const ribbon = data.featured ? championsRibbon(data.featured) : undefined;
  const colors = ribbon ? { ink: OG_CHAMPIONS.ink, muted: OG_CHAMPIONS.muted, accent: OG_CHAMPIONS.star } : { ink: OG.ink, muted: OG.muted, accent: OG.accentText };
  const outcomeStyle = ribbon ? CHAMPIONS_OUTCOME_STYLE : OUTCOME_STYLE;

  return ogImage(
    <OgFrame champions={ribbon}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 56 }}>
        <OgCrest src={crest} name={team.name} size={260} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          <div style={{ fontSize: 28, color: colors.accent, fontWeight: 700 }}>{teamSummary(data)}</div>
          <div style={{ fontFamily: "Barlow", fontSize: fitPixelSize(team.name, { width: 772, base: 110, min: 56, maxLines: 3, emPerChar: 0.46 }), lineHeight: 0.9, textTransform: "uppercase", color: colors.ink }}>
            {team.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            {row && (
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontFamily: "Barlow", fontSize: 72, color: colors.accent }}>{row.position}º</span>
                <span style={{ fontSize: 26, color: colors.muted }}>
                  de {standings.length} · {row.points} {row.points === 1 ? "punto" : "puntos"}
                </span>
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              {form.map((outcome, index) => (
                <div
                  key={index}
                  style={{
                    ...outcomeStyle[outcome],
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
