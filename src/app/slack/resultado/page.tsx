import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getTeam } from "@/lib/data";
import { describeSchedule, parseSchedule } from "@/notify/schedule";

// Where the Slack subscription flow ends (src/app/api/slack):
// ?equipo=<slug>&canal=#x&dia=4&hora=10:00 when it worked (&ya=1 if the channel
// was already subscribed), ?baja=1 after unsubscribing (src/app/slack/avisos),
// ?error=<reason> when not. Not worth indexing.
export const metadata: Metadata = { title: "Convocatorias en Slack", robots: { index: false } };

const ERRORS: Record<string, { title: string; text: string }> = {
  cancelado: { title: "Sin conectar", text: "Has cancelado la conexión con Slack. Puedes volver a intentarlo cuando quieras." },
  caducado: { title: "Enlace caducado", text: "La conexión con Slack ha caducado o empezó en otro navegador. Vuelve a pulsar el botón en la página del equipo." },
  fallo: { title: "Algo ha fallado", text: "Slack no ha respondido como esperábamos. Inténtalo otra vez en un rato." },
  equipo: { title: "Equipo no encontrado", text: "No encontramos ese equipo. Puede que haya cambiado de nombre." },
  "no-disponible": { title: "No disponible", text: "Los avisos en Slack todavía no están activados en esta web." },
  enlace: { title: "Enlace no válido", text: "Ese enlace de avisos no es válido o la suscripción ya no existe." },
};

export default function SlackPage({ searchParams }: PageProps<"/slack/resultado">) {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-20 sm:px-6">
      <Suspense fallback={<div className="h-48 w-full animate-pulse rounded-[22px] bg-line-soft" aria-busy="true" />}>
        <Result searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Result({ searchParams }: Pick<PageProps<"/slack/resultado">, "searchParams">) {
  const query = await searchParams;
  const param = (name: string) => (typeof query[name] === "string" ? query[name] : undefined);
  const slug = param("equipo");
  const team = slug ? await getTeam(slug) : null;
  const error = param("error");
  const back = team ? (
    <Link href={`/equipos/${team.slug}`} className="rounded-[10px] bg-accent px-4 py-3 font-semibold text-on-accent">
      Volver a {team.name}
    </Link>
  ) : (
    <Link href="/" className="rounded-[10px] bg-accent px-4 py-3 font-semibold text-on-accent">
      Volver a la portada
    </Link>
  );

  if (error || !team) {
    const { title, text } = ERRORS[error ?? "equipo"] ?? ERRORS.fallo;
    return (
      <>
        <h1 className="font-display text-6xl font-extrabold uppercase">{title}</h1>
        <p className="text-muted">{text}</p>
        {back}
      </>
    );
  }

  const channel = param("canal");
  const where = channel ? <strong>{channel}</strong> : "Ese canal";
  if (param("baja")) {
    return (
      <>
        <h1 className="font-display text-6xl font-extrabold uppercase">Sin avisos</h1>
        <p className="text-lg">
          {where} ya no recibirá las convocatorias de <strong>{team.name}</strong>.
        </p>
        <p className="text-muted">Si no usáis la app para otro equipo, también podéis quitarla de Slack.</p>
        {back}
      </>
    );
  }
  const schedule = parseSchedule(param("dia"), param("hora"));
  const when = schedule && (
    <p className="text-muted">
      Cada convocatoria llegará {describeSchedule(schedule)}, y al momento si cambia la hora o el campo. En cada mensaje tenéis un enlace para
      cambiar los avisos o daros de baja.
    </p>
  );
  if (param("ya")) {
    return (
      <>
        <h1 className="font-display text-6xl font-extrabold uppercase">Actualizado</h1>
        <p className="text-lg">
          {where} ya recibía las convocatorias de <strong>{team.name}</strong>: seguirán llegando una sola vez, con el horario que acabas de elegir.
        </p>
        {when}
        {back}
      </>
    );
  }
  return (
    <>
      <h1 className="font-display text-6xl font-extrabold uppercase">Hecho</h1>
      <p className="text-lg">
        Avisaremos {channel ? <>en <strong>{channel}</strong> </> : ""}de los partidos de <strong>{team.name}</strong>.
      </p>
      {when}
      {back}
    </>
  );
}
