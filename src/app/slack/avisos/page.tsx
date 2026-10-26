import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SlackScheduleFields } from "@/components/slack-schedule-fields";
import { db, schema } from "@/db/client";
import { describeSchedule } from "@/notify/schedule";
import { encryptionKey, verifySubscription } from "@/notify/secrets";
import { saveSchedule, unsubscribe } from "./actions";

// "Cambiar avisos o darse de baja" in every Slack call-up (?s=<signed token>):
// one channel's subscription, with no accounts. It reads the database as it is
// now, not the cached data the rest of the site shows.
export const metadata: Metadata = { title: "Avisos en Slack", robots: { index: false } };

export default function SlackSettingsPage({ searchParams }: PageProps<"/slack/avisos">) {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-14 sm:px-6 sm:py-20">
      <Suspense fallback={<div className="h-96 w-full animate-pulse rounded-[22px] bg-line-soft" aria-busy="true" />}>
        <Settings searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Settings({ searchParams }: Pick<PageProps<"/slack/avisos">, "searchParams">) {
  const { s, guardado } = await searchParams;
  const token = typeof s === "string" ? s : "";
  const id = verifySubscription(token, encryptionKey());
  const { subscriptions, teams } = schema;
  const [sub] =
    id === null
      ? []
      : await db
          .select({ subscription: subscriptions, teamName: teams.name, teamSlug: teams.slug })
          .from(subscriptions)
          .leftJoin(teams, eq(teams.id, subscriptions.teamId))
          .where(eq(subscriptions.id, id));
  if (!sub) {
    return (
      <>
        <h1 className="font-display text-6xl font-extrabold uppercase">Enlace no válido</h1>
        <p className="text-muted">Ese enlace de avisos no es válido o la suscripción ya no existe.</p>
        <Link href="/" className="rounded-[10px] bg-accent px-4 py-3 font-semibold text-on-accent">
          Volver a la portada
        </Link>
      </>
    );
  }

  const { subscription } = sub;
  const schedule = { weekday: subscription.notifyWeekday, time: subscription.notifyTime };
  const teamName = sub.teamName ?? "tu equipo";
  return (
    <>
      <h1 className="font-display text-5xl font-extrabold uppercase sm:text-6xl">Avisos en Slack</h1>
      <p className="text-lg">
        <strong>{subscription.channelName}</strong> ({subscription.workspaceName}) recibe las convocatorias de{" "}
        {sub.teamSlug ? (
          <Link href={`/equipos/${sub.teamSlug}`} className="font-semibold text-accent-text">
            {teamName}
          </Link>
        ) : (
          <strong>{teamName}</strong>
        )}
        .
      </p>
      {guardado && (
        <p role="status" className="w-full rounded-[14px] bg-accent-soft px-4 py-3 text-sm font-semibold">
          Guardado: avisaremos {describeSchedule(schedule)}.
        </p>
      )}
      <form action={saveSchedule} className="flex w-full flex-col items-start gap-4 rounded-[22px] border border-line bg-surface p-4 sm:p-5">
        <input type="hidden" name="s" value={token} />
        <SlackScheduleFields schedule={schedule} />
        <p className="text-sm text-muted">Si un partido cambia de hora o de campo, avisamos al momento.</p>
        <button type="submit" className="rounded-[10px] bg-accent px-4 py-3 font-semibold text-on-accent">
          Guardar
        </button>
      </form>
      <form action={unsubscribe} className="flex w-full flex-col items-start gap-3 rounded-[22px] border border-line bg-surface p-4 sm:p-5">
        <input type="hidden" name="s" value={token} />
        <h2 className="font-display text-2xl font-extrabold uppercase">Dejar de recibir avisos</h2>
        <p className="text-sm text-muted">El canal deja de recibir las convocatorias de {teamName}. Podéis volver a apuntarlo cuando queráis.</p>
        <button type="submit" className="rounded-[10px] border border-line px-4 py-3 font-semibold text-loss hover:border-loss">
          Dejar de recibir avisos
        </button>
      </form>
    </>
  );
}
