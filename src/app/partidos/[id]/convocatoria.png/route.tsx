import { capitalize, formatLongDate } from "@/lib/dates";
import { crestDataUrl, OG, OgCrest, ogImage } from "@/lib/og";
import { fitPixelSize } from "@/lib/text";
import { getMatchPageData, type TeamSide } from "@/lib/views/match";

/**
 * The image in a Slack call-up (src/notify/call-ups.ts): a short band with both
 * crests, the day and the kick-off. Slack draws images as wide as the message,
 * so the share image (opengraph-image, 1200×630) took a whole screen; this one
 * is a third shorter and leaves out what the message already says.
 */
const SIZE = { width: 1200, height: 400 };
/** The day and kick-off column, wide enough for the longest day on one line. */
const CENTER_WIDTH = 400;

export async function GET(_request: Request, { params }: RouteContext<"/partidos/[id]/convocatoria.png">) {
  const { id } = await params;
  const data = /^\d+$/.test(id) ? await getMatchPageData(Number(id)) : null;
  if (!data) return new Response("Not found", { status: 404 });
  const { match, home, away } = data;
  const day = capitalize(formatLongDate(match.date, data.now));
  const [homeCrest, awayCrest] = await Promise.all([crestDataUrl(home.logoUrl), crestDataUrl(away.logoUrl)]);

  const image = await ogImage(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: OG.surface, fontFamily: "Inter" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, padding: "0 56px" }}>
        <Side side={home} crest={homeCrest} />
        <div style={{ width: CENTER_WIDTH, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              background: OG.accentSoft,
              color: OG.accentText,
              // "Miércoles 30 de septiembre" shrinks instead of wrapping.
              fontSize: fitPixelSize(day, { width: CENTER_WIDTH - 40, base: 24, min: 18, maxLines: 1, emPerChar: 0.68 }),
              fontWeight: 700,
              letterSpacing: 2,
              whiteSpace: "nowrap",
              padding: "8px 20px",
              borderRadius: 999,
            }}
          >
            {day}
          </div>
          <div style={{ fontFamily: "Barlow", fontSize: 130, lineHeight: 1, color: OG.ink }}>{match.date.slice(11, 16)}</div>
        </div>
        <Side side={away} crest={awayCrest} />
      </div>
      <div style={{ height: 12, background: OG.accent }} />
    </div>,
    SIZE,
  );
  // Slack downloads it once per message; the URL carries the date and venue
  // (?v=), so a changed match gets a new one.
  image.headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
  return image;
}

function Side({ side, crest }: { side: TeamSide; crest: string | null }) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, minWidth: 0 }}>
      <OgCrest src={crest} name={side.name} size={150} />
      <div
        style={{
          fontFamily: "Barlow",
          fontSize: fitPixelSize(side.name, { width: 320, base: 46, min: 28, maxLines: 3, emPerChar: 0.46 }),
          lineHeight: 1,
          textAlign: "center",
          textTransform: "uppercase",
          color: OG.ink,
        }}
      >
        {side.name}
      </div>
    </div>
  );
}
