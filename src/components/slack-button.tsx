import { slackApp } from "@/notify/slack-oauth";

/**
 * Subscribes a Slack channel to the team's call-ups: Slack's own screen picks
 * the workspace and the channel (src/app/api/slack). Hidden until the Slack app
 * is configured. A plain link, not <Link>: it leaves the site.
 */
export function SlackButton({ slug }: { slug: string }) {
  if (!slackApp()) return null;
  return (
    <a
      href={`/api/slack/instalar?equipo=${encodeURIComponent(slug)}`}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-sm font-semibold hover:border-ink"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 8 2.5 8h-17S6 15 6 9Z" />
        <path d="M10.3 20.5a2 2 0 0 0 3.4 0" />
      </svg>
      Recibir convocatorias en Slack
    </a>
  );
}
