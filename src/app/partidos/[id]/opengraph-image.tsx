import { capitalize, formatLongDate } from "@/lib/dates";
import { crestDataUrl, OG, OG_SIZE, OgCrest, OgFrame, ogImage } from "@/lib/og";
import { fitPixelSize } from "@/lib/text";
import { getMatchPageData, matchSummary, type TeamSide } from "@/lib/views/match";
import DefaultImage from "../../opengraph-image";

export const alt = "Resultado del partido";
export const size = OG_SIZE;
export const contentType = "image/png";

// The same matches as the page are generated at build time and the rest on first request, then cached and
// revalidated like the page; without a list the image would be drawn again on every request.
export { generateStaticParams } from "./page";

/** The score or kick-off column, wide enough for the longest day on one line. */
const CENTER_WIDTH = 420;

/** The shared link's image: both crests and the score, or the kick-off for a match not played yet. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = /^\d+$/.test(id) ? await getMatchPageData(Number(id)) : null;
  if (!data) return DefaultImage();
  const { match, home, away } = data;
  const day = capitalize(formatLongDate(match.date, data.now));
  const [homeCrest, awayCrest] = await Promise.all([crestDataUrl(home.logoUrl), crestDataUrl(away.logoUrl)]);
  const homeWon = match.played && match.homeGoals! > match.awayGoals!;
  const awayWon = match.played && match.awayGoals! > match.homeGoals!;

  return ogImage(
    <OgFrame aside={matchSummary(data)}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        <Side side={home} crest={homeCrest} faded={awayWon} />
        <div style={{ width: CENTER_WIDTH, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, flexShrink: 0 }}>
          {match.played ? (
            <>
              <div style={{ display: "flex", alignItems: "center", fontFamily: "Barlow", fontSize: 190, lineHeight: 1 }}>
                <span style={{ color: awayWon ? OG.muted : OG.ink }}>{match.homeGoals}</span>
                <span style={{ color: OG.line, margin: "0 18px" }}>–</span>
                <span style={{ color: homeWon ? OG.muted : OG.ink }}>{match.awayGoals}</span>
              </div>
              <Pill background={OG.ink} color={OG.surface}>
                FINAL
              </Pill>
            </>
          ) : (
            <>
              <Pill background={OG.accentSoft} color={OG.accentText} fontSize={dayFontSize(day)}>
                {day}
              </Pill>
              <div style={{ fontFamily: "Barlow", fontSize: 150, lineHeight: 1, color: OG.ink }}>{match.date.slice(11, 16)}</div>
            </>
          )}
        </div>
        <Side side={away} crest={awayCrest} faded={homeWon} />
      </div>
    </OgFrame>,
  );
}

function Side({ side, crest, faded }: { side: TeamSide; crest: string | null; faded: boolean }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 22, minWidth: 0 }}>
      <OgCrest src={crest} name={side.name} size={170} />
      <div
        style={{
          fontFamily: "Barlow",
          fontSize: fitPixelSize(side.name, { width: 310, base: 54, min: 32, maxLines: 3, emPerChar: 0.46 }),
          lineHeight: 1,
          textAlign: "center",
          textTransform: "uppercase",
          color: faded ? OG.muted : OG.ink,
        }}
      >
        {side.name}
      </div>
    </div>
  );
}

function Pill({ background, color, fontSize = 24, children }: { background: string; color: string; fontSize?: number; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", background, color, fontSize, fontWeight: 700, letterSpacing: 2, whiteSpace: "nowrap", padding: "8px 20px", borderRadius: 999 }}>
      {children}
    </div>
  );
}

/** The day on one line: "Miércoles 30 de septiembre" shrinks instead of wrapping. */
function dayFontSize(day: string): number {
  return fitPixelSize(day, { width: CENTER_WIDTH - 40, base: 24, min: 18, maxLines: 1, emPerChar: 0.68 });
}
