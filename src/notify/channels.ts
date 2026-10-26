// Where call-ups are sent. The env-configured channels are on when their
// environment variables are set, so locally (and in any run without them)
// nothing is sent; Slack subscriptions come from the database (run.ts).

import { escapeHtml, NOTIFY_DAYS, toSlackMessage, toTelegramHtml, type CallUpMessage } from "./call-ups";
import { isRevokedWebhook } from "./targets";

export interface Channel {
  /** Stored in `notifications.channel`: each channel keeps its own record of what it sent. */
  name: string;
  send(message: CallUpMessage): Promise<void>;
}

/** Slack says the webhook is gone for good: the subscription should be deleted, not retried. */
export class RevokedWebhookError extends Error {}

async function post(url: string, body: unknown, what: string): Promise<Response> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    const Failure = isRevokedWebhook(res.status, text) ? RevokedWebhookError : Error;
    throw new Failure(`${what} failed: ${res.status} ${text}`);
  }
  return res;
}

/** A bot (from @BotFather) in a group: the message, then a poll to say who is coming. */
function telegram(token: string, chatId: string): Channel {
  const api = (method: string) => `https://api.telegram.org/bot${token}/${method}`;
  return {
    name: "telegram",
    async send(message) {
      await post(
        api("sendMessage"),
        { chat_id: chatId, text: toTelegramHtml(message), parse_mode: "HTML", link_preview_options: { url: message.url } },
        "Telegram sendMessage",
      );
      await post(
        api("sendPoll"),
        { chat_id: chatId, question: message.question, options: [{ text: "Sí" }, { text: "No" }, { text: "Duda" }], is_anonymous: false },
        "Telegram sendPoll",
      );
    },
  };
}

/** A Slack app's Incoming Webhook, which posts to the channel it was created for. */
export function slack(webhookUrl: string, name = "slack"): Channel {
  return {
    name,
    async send(message) {
      await post(webhookUrl, toSlackMessage(message), "Slack webhook");
    },
  };
}

export function configuredChannels(env: NodeJS.ProcessEnv = process.env): Channel[] {
  const channels: Channel[] = [];
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) channels.push(telegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID));
  if (env.SLACK_WEBHOOK_URL) channels.push(slack(env.SLACK_WEBHOOK_URL));
  return channels;
}

/** The first message of a new subscription, which also proves the webhook works. */
export async function sendSlackWelcome(webhookUrl: string, team: { name: string; url: string }): Promise<void> {
  const text = [
    `✅ Hecho, os avisaré de los partidos de *<${team.url}|${escapeHtml(team.name)}>*.`,
    `Cada convocatoria llega aquí ${NOTIFY_DAYS} días antes del partido, y otra vez si cambia la hora o el campo.`,
  ].join("\n");
  await post(webhookUrl, { text, unfurl_links: false }, "Slack webhook");
}
