"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { schema } from "@/db/client";
import { writableDb } from "@/db/writer";
import { sendScheduleChanged, sendUnsubscribed } from "@/notify/channels";
import { parseSchedule } from "@/notify/schedule";
import { decrypt, encryptionKey, verifySubscription } from "@/notify/secrets";
import { settingsUrl } from "@/notify/slack-oauth";
import { subscriptionKey } from "@/notify/targets";

// The settings page's two forms. Server Actions answer any POST, so each one
// checks the signed token itself: it is all that stands for an account here.

function subscriptionId(formData: FormData): number {
  const id = verifySubscription(String(formData.get("s") ?? ""), encryptionKey());
  if (id === null) redirect("/slack/resultado?error=enlace");
  return id;
}

export async function saveSchedule(formData: FormData) {
  const id = subscriptionId(formData);
  const token = String(formData.get("s"));
  const schedule = parseSchedule(formData.get("dia"), formData.get("hora"));
  const db = writableDb();
  const { subscriptions, teams } = schema;
  const [row] = await db
    .select({ subscription: subscriptions, teamName: teams.name, teamSlug: teams.slug })
    .from(subscriptions)
    .leftJoin(teams, eq(teams.id, subscriptions.teamId))
    .where(eq(subscriptions.id, id));
  if (!row) redirect("/slack/resultado?error=enlace");
  const { subscription } = row;
  if (schedule && (schedule.weekday !== subscription.notifyWeekday || schedule.time !== subscription.notifyTime)) {
    await db.update(subscriptions).set({ notifyWeekday: schedule.weekday, notifyTime: schedule.time }).where(eq(subscriptions.id, id));
    // Server Actions already check that Origin matches the host: the link points
    // to this deployment, so it also works on a preview.
    const origin = (await headers()).get("origin") ?? siteConfig.url;
    const key = encryptionKey();
    const team = { name: row.teamName ?? "vuestro equipo", url: `${siteConfig.url}/equipos/${row.teamSlug ?? ""}` };
    await sendScheduleChanged(decrypt(subscription.webhookUrl, key), team, schedule, settingsUrl(id, key, origin)).catch((error) => {
      // Saved all the same: the next call-up's footer says the new schedule.
      console.error("Slack schedule message failed", error);
    });
  }
  redirect(`/slack/avisos?s=${encodeURIComponent(token)}&guardado=1`);
}

export async function unsubscribe(formData: FormData) {
  const id = subscriptionId(formData);
  const db = writableDb();
  const { subscriptions, notifications, teams } = schema;
  const [row] = await db
    .select({ channel: subscriptions.channelName, webhookUrl: subscriptions.webhookUrl, teamName: teams.name, slug: teams.slug })
    .from(subscriptions)
    .leftJoin(teams, eq(teams.id, subscriptions.teamId))
    .where(eq(subscriptions.id, id));
  if (!row) redirect("/slack/resultado?error=enlace");
  await db.delete(subscriptions).where(eq(subscriptions.id, id));
  await db.delete(notifications).where(eq(notifications.channel, subscriptionKey(id)));
  const origin = (await headers()).get("origin") ?? siteConfig.url;
  const team = { name: row.teamName ?? "vuestro equipo", url: `${siteConfig.url}/equipos/${row.slug ?? ""}` };
  await sendUnsubscribed(decrypt(row.webhookUrl, encryptionKey()), team, `${origin}/slack/nuevo?equipo=${row.slug ?? ""}`).catch((error) => {
    // Unsubscribed all the same.
    console.error("Slack goodbye message failed", error);
  });
  redirect(`/slack/resultado?${new URLSearchParams({ baja: "1", equipo: row.slug ?? "", canal: row.channel })}`);
}
