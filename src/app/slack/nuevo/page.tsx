import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SlackScheduleFields } from "@/components/slack-schedule-fields";
import { getTeam } from "@/lib/data";
import { slackApp } from "@/notify/slack-oauth";

// "Recibir convocatorias en Slack" on a team's page lands here (?equipo=<slug>):
// the visitor picks when the call-ups come, then goes on to Slack's own screen
// (src/app/api/slack/instalar), which picks the workspace and the channel.
export const metadata: Metadata = { title: "Convocatorias en Slack", robots: { index: false } };

export default function NewSlackSubscriptionPage({ searchParams }: PageProps<"/slack/nuevo">) {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-14 sm:px-6 sm:py-20">
      <Suspense fallback={<div className="h-80 w-full animate-pulse rounded-[22px] bg-line-soft" aria-busy="true" />}>
        <Form searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/slack/nuevo">, "searchParams">) {
  const { equipo } = await searchParams;
  const team = typeof equipo === "string" ? await getTeam(equipo) : null;
  if (!team || !slackApp()) {
    return (
      <>
        <h1 className="font-display text-6xl font-extrabold uppercase">No disponible</h1>
        <p className="text-muted">{team ? "Los avisos en Slack todavía no están activados en esta web." : "No encontramos ese equipo."}</p>
      </>
    );
  }
  return (
    <>
      <h1 className="font-display text-5xl font-extrabold uppercase sm:text-6xl">Convocatorias en Slack</h1>
      <p className="text-lg">
        Recibe en un canal de Slack cada partido de <strong>{team.name}</strong>: fecha, hora, campo y rival, para confirmar la asistencia con una
        reacción.
      </p>
      <form action="/api/slack/instalar" className="flex w-full flex-col items-start gap-4 rounded-[22px] border border-line bg-surface p-4 sm:p-5">
        <input type="hidden" name="equipo" value={team.slug} />
        <SlackScheduleFields />
        <p className="text-sm text-muted">Si un partido cambia de hora o de campo, avisamos al momento.</p>
        <button type="submit" className="rounded-[10px] bg-accent px-4 py-3 font-semibold text-on-accent">
          Continuar en Slack
        </button>
      </form>
      <p className="text-sm text-muted">
        En Slack eliges el espacio de trabajo y el canal. Sin cuentas: el canal es el que se apunta.{" "}
        <Link href="/slack" className="font-semibold text-ink underline-offset-2 hover:underline">
          Cómo funciona
        </Link>
      </p>
    </>
  );
}
