import type { Metadata } from "next";
import Image from "next/image";
import { Suspense } from "react";
import { Eyebrow } from "@/components/featured-match";
import { SlackTeamPicker } from "@/components/slack-team-picker";
import { siteConfig } from "@/config/site";
import { getCurrentSeason, getTeams } from "@/lib/data";
import { getSlackExample } from "@/lib/views/slack";
import type { CallUpMessage } from "@/notify/call-ups";
import { DEFAULT_SCHEDULE, describeSchedule } from "@/notify/schedule";
import { SLACK_APP_NAME, slackApp } from "@/notify/slack-oauth";

// The Slack bot's own page: what it sends and a team search to add it to a
// channel. Subscribing goes on in /slack/nuevo; the flow ends in /slack/resultado.

export const metadata: Metadata = {
  title: "Convocatorias en Slack",
  description: `${SLACK_APP_NAME} avisa en vuestro canal de Slack de cada partido de vuestro equipo: fecha, hora, campo y rival.`,
};

export default function SlackBotPage() {
  return (
    <main className="mx-auto grid max-w-7xl items-start gap-8 px-4 pt-10 sm:px-6 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
      <div className="flex min-w-0 flex-col gap-6">
        <header className="flex flex-col gap-3">
          <Eyebrow>Slack</Eyebrow>
          <h1 className="font-display text-5xl leading-none font-extrabold uppercase sm:text-6xl">{SLACK_APP_NAME}</h1>
          <p className="text-lg">
            Las convocatorias de tu equipo, en el canal de Slack de la empresa: fecha, hora, campo y rival de cada partido, para que cada uno confirme
            con una reacción.
          </p>
        </header>
        <Suspense fallback={<div className="h-36 w-full animate-pulse rounded-[22px] bg-line-soft" aria-busy="true" />}>
          <Picker />
        </Suspense>
        <Steps />
        <Faq />
      </div>
      <Suspense fallback={<div className="h-[640px] w-full animate-pulse rounded-[22px] bg-line-soft" aria-busy="true" />}>
        <Example />
      </Suspense>
    </main>
  );
}

async function Picker() {
  if (!slackApp()) {
    return <p className="rounded-[22px] border border-line bg-surface p-4 text-muted sm:p-5">Los avisos en Slack todavía no están activados en esta web.</p>;
  }
  const [teams, season] = await Promise.all([getTeams(), getCurrentSeason()]);
  const playing = teams.filter((team) => team.seasonIds.includes(season.id)).map(({ slug, name, logoUrl }) => ({ slug, name, logoUrl }));
  return (
    <section className="rounded-[22px] border border-line bg-surface p-4 sm:p-5">
      <SlackTeamPicker teams={playing} />
    </section>
  );
}

function Steps() {
  const steps = [
    ["Elige tu equipo", "y el día y la hora del aviso: de lunes a viernes, antes de cada partido."],
    ["Elige el canal", "en Slack, que antes te pide el espacio de trabajo."],
    ["Llega la convocatoria", "cada semana que haya partido, y otra al momento si cambia la hora o el campo."],
  ];
  return (
    <section aria-labelledby="como-funciona" className="flex flex-col gap-3">
      <h2 id="como-funciona" className="font-display text-2xl font-extrabold uppercase">
        Cómo funciona
      </h2>
      <ol className="flex flex-col gap-3">
        {steps.map(([title, text], i) => (
          <li key={title} className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-soft font-display text-lg font-extrabold text-accent-text">
              {i + 1}
            </span>
            <p className="pt-1">
              <strong>{title}</strong> {text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Faq() {
  const questions = [
    ["¿Cuánto cuesta?", "Nada, y no hace falta cuenta: lo que se apunta es el canal."],
    [
      "¿Qué puede hacer en mi Slack?",
      "Solo publicar en el canal que elijas. No lee mensajes ni ve a los miembros.",
    ],
    [
      "¿Cómo cambio el horario o lo quito?",
      "Cada mensaje trae un enlace «Cambiar avisos o darse de baja». También podéis quitar la app desde Slack.",
    ],
    ["¿Es oficial?", "No. Es una web no oficial que toma los datos de futbolempresas.es."],
  ];
  return (
    <section aria-labelledby="preguntas" className="flex flex-col gap-3">
      <h2 id="preguntas" className="font-display text-2xl font-extrabold uppercase">
        Preguntas
      </h2>
      <dl className="flex flex-col gap-3">
        {questions.map(([question, answer]) => (
          <div key={question}>
            <dt className="font-semibold">{question}</dt>
            <dd className="text-muted">{answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

async function Example() {
  const message = await getSlackExample();
  if (!message) return null;
  return (
    <figure className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-24">
      <figcaption className="text-sm font-semibold text-muted">Así llega al canal</figcaption>
      <SlackMessage message={message} />
    </figure>
  );
}

/** A drawing of the call-up as Slack shows it (toSlackMessage in src/notify/call-ups.ts), with the same text. */
function SlackMessage({ message }: { message: CallUpMessage }) {
  // The image from this site, so it also works on previews and locally.
  const image = message.imageUrl.replace(siteConfig.url, "");
  const path = message.url.replace(siteConfig.url, "");
  return (
    <div className="flex gap-3 rounded-[22px] border border-line bg-surface p-4 text-[15px] sm:p-5">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent font-display text-base font-extrabold text-on-accent"
      >
        F7
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <strong>{SLACK_APP_NAME}</strong>
          <span className="rounded bg-line-soft px-1 text-[10px] font-bold text-muted">APP</span>
          <span className="text-xs text-muted">{DEFAULT_SCHEDULE.time}</span>
        </p>
        <p className="text-lg font-bold">⚽ {message.title}</p>
        <p>
          ¡Hola equipo!
          <br />
          Os dejo por aquí todos los detalles del próximo partido.
        </p>
        <p>
          🗓️ <strong>Fecha:</strong> {message.date}
          <br />
          ⏰ <strong>Hora:</strong> {message.time} h
          {message.venue && (
            <>
              <br />
              📍 <strong>Lugar:</strong>{" "}
              <a href={message.venue.url} className="text-accent-text hover:underline">
                {message.venue.name}
              </a>
            </>
          )}
          <br />
          🆚 <strong>Encuentro:</strong> {message.matchup}
        </p>
        <p>
          👉{" "}
          <a href={path} className="font-bold text-accent-text hover:underline">
            Ver el partido en la web
          </a>
        </p>
        <Image
          src={image}
          alt={`${message.matchup}, ${message.when}`}
          width={1200}
          height={400}
          unoptimized
          loading="eager"
          className="w-full max-w-[420px] rounded-lg border border-line"
        />
        <p>Por favor, confirmad vuestra asistencia lo antes posible reaccionando a este mensaje (✅ voy / ❌ no voy)</p>
        <p className="flex gap-1.5" aria-hidden="true">
          <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-sm">✅ 9</span>
          <span className="rounded-full border border-line bg-canvas px-2 py-0.5 text-sm">❌ 2</span>
        </p>
        <p className="border-t border-line-soft pt-2 text-xs text-muted">
          🔔 <strong>{SLACK_APP_NAME}</strong> avisa {describeSchedule(DEFAULT_SCHEDULE)} · <span className="text-accent-text">Cambiar avisos o darse de baja</span>
        </p>
      </div>
    </div>
  );
}
