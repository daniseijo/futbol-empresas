// "Add to Slack" with OAuth v2 and only the `incoming-webhook` scope: Slack's
// consent screen lets the visitor pick the workspace and the channel, and hands
// back a webhook for that channel. No user accounts and no bot token.
// https://docs.slack.dev/authentication/installing-with-oauth

export const NONCE_COOKIE = "slack_oauth_nonce";
/** The cookie only travels to these routes. */
export const COOKIE_PATH = "/api/slack";

/** Where Slack sends the visitor back: register it in the app (OAuth & Permissions › Redirect URLs). */
export function redirectUri(origin: string): string {
  return `${origin}/api/slack/autorizado`;
}

export interface SlackApp {
  clientId: string;
  clientSecret: string;
}

/** SLACK_CLIENT_ID and SLACK_CLIENT_SECRET, from the app's Basic Information; null when they are not set. */
export function slackApp(env: NodeJS.ProcessEnv = process.env): SlackApp | null {
  return env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET ? { clientId: env.SLACK_CLIENT_ID, clientSecret: env.SLACK_CLIENT_SECRET } : null;
}

export function authorizeUrl(app: SlackApp, origin: string, state: string): string {
  const params = new URLSearchParams({ client_id: app.clientId, scope: "incoming-webhook", redirect_uri: redirectUri(origin), state });
  return `https://slack.com/oauth/v2/authorize?${params}`;
}

export interface Installation {
  workspaceId: string;
  workspaceName: string;
  channelId: string;
  channelName: string;
  webhookUrl: string;
}

/** Trades the callback's code for the channel's webhook. */
export async function exchangeCode(app: SlackApp, origin: string, code: string): Promise<Installation> {
  const res = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    body: new URLSearchParams({ client_id: app.clientId, client_secret: app.clientSecret, code, redirect_uri: redirectUri(origin) }),
  });
  const body = (await res.json()) as {
    ok: boolean;
    error?: string;
    team?: { id: string; name: string };
    incoming_webhook?: { channel: string; channel_id: string; url: string };
  };
  if (!body.ok || !body.team || !body.incoming_webhook) throw new Error(`Slack oauth.v2.access failed: ${body.error ?? res.status}`);
  return {
    workspaceId: body.team.id,
    workspaceName: body.team.name,
    channelId: body.incoming_webhook.channel_id,
    channelName: body.incoming_webhook.channel,
    webhookUrl: body.incoming_webhook.url,
  };
}
