"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { schema } from "@/db/client";
import { writableDb } from "@/db/writer";
import { parseSchedule } from "@/notify/schedule";
import { encryptionKey, verifySubscription } from "@/notify/secrets";
import { subscriptionKey } from "@/notify/targets";

// The settings page's two forms. Server Actions answer any POST, so each one
// checks the signed token itself: it is all that stands for an account here.

function subscriptionId(formData: FormData): number {
  const id = verifySubscription(String(formData.get("s") ?? ""), encryptionKey());
  if (id === null) redirect("/slack?error=enlace");
  return id;
}

export async function saveSchedule(formData: FormData) {
  const id = subscriptionId(formData);
  const token = String(formData.get("s"));
  const schedule = parseSchedule(formData.get("dia"), formData.get("hora"));
  if (schedule) {
    const { subscriptions } = schema;
    await writableDb()
      .update(subscriptions)
      .set({ notifyWeekday: schedule.weekday, notifyTime: schedule.time })
      .where(eq(subscriptions.id, id));
  }
  redirect(`/slack/avisos?s=${encodeURIComponent(token)}&guardado=1`);
}

export async function unsubscribe(formData: FormData) {
  const id = subscriptionId(formData);
  const db = writableDb();
  const { subscriptions, notifications, teams } = schema;
  const [row] = await db
    .select({ channel: subscriptions.channelName, slug: teams.slug })
    .from(subscriptions)
    .leftJoin(teams, eq(teams.id, subscriptions.teamId))
    .where(eq(subscriptions.id, id));
  if (!row) redirect("/slack?error=enlace");
  await db.delete(subscriptions).where(eq(subscriptions.id, id));
  await db.delete(notifications).where(eq(notifications.channel, subscriptionKey(id)));
  redirect(`/slack?${new URLSearchParams({ baja: "1", equipo: row.slug ?? "", canal: row.channel })}`);
}
