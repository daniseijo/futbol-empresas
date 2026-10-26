import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getTeam } from "@/lib/data";
import { NOTIFY_DAYS } from "@/notify/call-ups";

// Where the Slack subscription flow ends (src/app/api/slack): ?equipo=<slug>&canal=#x
// when it worked (plus &ya=1 when the channel was already subscribed), ?error=<reason> when not. Not worth indexing.
export const metadata: Metadata = {
  title: "Convocatorias en Slack",
  robots: { index: false },
};

const ERRORS: Record<string, { title: string; text: string }> = {
  cancelado: {
    title: "Sin conectar",
    text: "Has cancelado la conexión con Slack. Puedes volver a intentarlo cuando quieras.",
  },
  caducado: {
    title: "Enlace caducado",
    text: "La conexión con Slack ha caducado o empezó en otro navegador. Vuelve a pulsar el botón en la página del equipo.",
  },
  fallo: {
    title: "Algo ha fallado",
    text: "Slack no ha respondido como esperábamos. Inténtalo otra vez en un rato.",
  },
  equipo: {
    title: "Equipo no encontrado",
    text: "No encontramos ese equipo. Puede que haya cambiado de nombre.",
  },
  "no-disponible": {
    title: "No disponible",
    text: "Los avisos en Slack todavía no están activados en esta web.",
  },
};

export default function SlackPage({ searchParams }: PageProps<"/slack">) {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-20 sm:px-6">
      <Suspense
        fallback={
          <div
            className="h-48 w-full animate-pulse rounded-[22px] bg-line-soft"
            aria-busy="true"
          />
        }
      >
        <Result searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Result({
  searchParams,
}: Pick<PageProps<"/slack">, "searchParams">) {
  const query = await searchParams;
  const param = (name: string) =>
    typeof query[name] === "string" ? query[name] : undefined;
  const slug = param("equipo");
  const team = slug ? await getTeam(slug) : null;
  const error = param("error");
  const back = team ? (
    <Link
      href={`/equipos/${team.slug}`}
      className="rounded-[10px] bg-accent px-4 py-3 font-semibold text-on-accent"
    >
      Volver a {team.name}
    </Link>
  ) : (
    <Link
      href="/"
      className="rounded-[10px] bg-accent px-4 py-3 font-semibold text-on-accent"
    >
      Volver a la portada
    </Link>
  );

  if (error || !team) {
    const { title, text } = ERRORS[error ?? "equipo"] ?? ERRORS.fallo;
    return (
      <>
        <h1 className="font-display text-6xl font-extrabold uppercase">
          {title}
        </h1>
        <p className="text-muted">{text}</p>
        {back}
      </>
    );
  }

  const channel = param("canal");
  if (param("ya")) {
    return (
      <>
        <h1 className="font-display text-6xl font-extrabold uppercase">
          Ya estaba
        </h1>
        <p className="text-lg">
          {channel ? <strong>{channel}</strong> : "Ese canal"} ya recibía las
          convocatorias de <strong>{team.name}</strong>. No hace falta hacer
          nada más: seguirán llegando una sola vez.
        </p>
        {back}
      </>
    );
  }
  return (
    <>
      <h1 className="font-display text-6xl font-extrabold uppercase">Hecho</h1>
      <p className="text-lg">
        Avisaremos{" "}
        {channel ? (
          <>
            en <strong>{channel}</strong>{" "}
          </>
        ) : (
          ""
        )}
        de los partidos de <strong>{team.name}</strong>.
      </p>
      <p className="text-muted">
        Cada convocatoria llega {NOTIFY_DAYS} días antes del partido, y otra vez
        si cambia la hora o el campo. Para dejar de recibirlas, quitad la app de
        Slack del canal o del espacio de trabajo.
      </p>
      {back}
    </>
  );
}
