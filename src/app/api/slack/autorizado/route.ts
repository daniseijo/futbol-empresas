import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { siteConfig } from "@/config/site";
import { writableDb } from "@/db/writer";
import { schema } from "@/db/client";
import { getTeam } from "@/lib/data";
import { nowInMadrid } from "@/lib/dates";
import { sendSlackWelcome } from "@/notify/channels";
import { DEFAULT_SCHEDULE, parseSchedule } from "@/notify/schedule";
import { encrypt, encryptionKey, verifyState } from "@/notify/secrets";
import { COOKIE_PATH, exchangeCode, NONCE_COOKIE, settingsUrl, slackApp } from "@/notify/slack-oauth";

/**
 * Slack's redirect after the consent screen: stores the channel's webhook
 * (encrypted) as a subscription to the team, says hello in the channel and
 * shows the confirmation page. `pnpm notify` does the rest.
 */
export async function GET(request: NextRequest) {
  const done = (params: Record<string, string>) => {
    const response = NextResponse.redirect(new URL(`/slack/resultado?${new URLSearchParams(params)}`, request.url));
    response.cookies.delete({ name: NONCE_COOKIE, path: COOKIE_PATH });
    return response;
  };
  const app = slackApp();
  if (!app) return done({ error: "no-disponible" });

  const query = request.nextUrl.searchParams;
  const state = verifyState(query.get("state") ?? "", app.clientSecret, request.cookies.get(NONCE_COOKIE)?.value);
  if (!state) return done({ error: "caducado" });
  const team = await getTeam(state.slug);
  if (!team) return done({ error: "equipo" });
  // The visitor pressed "Cancel" on Slack's screen.
  const code = query.get("code");
  if (query.get("error") || !code) return done({ error: "cancelado", equipo: team.slug });

  const schedule = parseSchedule(state.weekday, state.time) ?? DEFAULT_SCHEDULE;
  let channelName: string;
  let again = false;
  try {
    const installation = await exchangeCode(app, request.nextUrl.origin, code);
    channelName = installation.channelName;
    const row = {
      teamId: team.id,
      workspaceId: installation.workspaceId,
      workspaceName: installation.workspaceName,
      channelId: installation.channelId,
      channelName: installation.channelName,
      notifyWeekday: schedule.weekday,
      notifyTime: schedule.time,
      webhookUrl: encrypt(installation.webhookUrl, encryptionKey()),
      createdAt: nowInMadrid(),
    };
    const db = writableDb();
    const { subscriptions } = schema;
    const [existing] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(and(eq(subscriptions.teamId, team.id), eq(subscriptions.workspaceId, row.workspaceId), eq(subscriptions.channelId, row.channelId)));
    again = Boolean(existing);
    // Subscribing the same channel again keeps its id, and so what it was already
    // sent; it takes the webhook and the schedule just picked.
    const [{ id }] = await db
      .insert(subscriptions)
      .values(row)
      .onConflictDoUpdate({
        target: [subscriptions.teamId, subscriptions.workspaceId, subscriptions.channelId],
        set: {
          webhookUrl: row.webhookUrl,
          workspaceName: row.workspaceName,
          channelName: row.channelName,
          notifyWeekday: row.notifyWeekday,
          notifyTime: row.notifyTime,
        },
      })
      .returning({ id: subscriptions.id });
    // Only the first time: subscribing again just replaces the webhook and the schedule.
    if (!again) {
      const teamLink = { name: team.name, url: `${siteConfig.url}/equipos/${team.slug}` };
      // The settings link points to this deployment, so it also works on a preview.
      const settings = settingsUrl(id, encryptionKey(), request.nextUrl.origin);
      await sendSlackWelcome(installation.webhookUrl, teamLink, schedule, settings).catch((error) => {
        // Subscribed all the same: the next call-up will tell.
        console.error("Slack welcome message failed", error);
      });
    }
  } catch (error) {
    console.error("Slack subscription failed", error);
    return done({ error: "fallo", equipo: team.slug });
  }
  return done({ equipo: team.slug, canal: channelName, dia: String(schedule.weekday), hora: schedule.time, ...(again && { ya: "1" }) });
}
