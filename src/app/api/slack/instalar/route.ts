import { NextResponse, type NextRequest } from "next/server";
import { getTeam } from "@/lib/data";
import { newNonce, signState, STATE_TTL_SECONDS } from "@/notify/secrets";
import { authorizeUrl, COOKIE_PATH, NONCE_COOKIE, slackApp } from "@/notify/slack-oauth";

/**
 * "Recibir convocatorias en Slack" on a team's page (?equipo=<slug>): sends the
 * visitor to Slack's consent screen. The team travels in the signed `state`,
 * and a nonce in a cookie ties the callback to this browser.
 */
export async function GET(request: NextRequest) {
  const app = slackApp();
  if (!app) return NextResponse.redirect(new URL("/slack?error=no-disponible", request.url));
  const slug = request.nextUrl.searchParams.get("equipo") ?? "";
  const team = slug ? await getTeam(slug) : null;
  if (!team) return NextResponse.redirect(new URL("/slack?error=equipo", request.url));

  const nonce = newNonce();
  const state = signState({ slug: team.slug, nonce, expiresAt: Date.now() + STATE_TTL_SECONDS * 1000 }, app.clientSecret);
  const response = NextResponse.redirect(authorizeUrl(app, request.nextUrl.origin, state));
  response.cookies.set(NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    // Lax: the browser sends it on Slack's top-level redirect back.
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: STATE_TTL_SECONDS,
  });
  return response;
}
