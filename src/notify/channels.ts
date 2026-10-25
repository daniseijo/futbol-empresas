// Where call-ups are sent. A channel is on when its environment variables are
// set, so locally (and in any run without them) nothing is sent.

import { toSlackMrkdwn, toTelegramHtml, type CallUpMessage } from "./call-ups";

export interface Channel {
  /** Stored in `notifications.channel`: each channel keeps its own record of what it sent. */
  name: string;
  send(message: CallUpMessage): Promise<void>;
}

async function post(url: string, body: unknown, what: string): Promise<Response> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${what} failed: ${res.status} ${await res.text()}`);
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
function slack(webhookUrl: string): Channel {
  return {
    name: "slack",
    async send(message) {
      await post(webhookUrl, { text: toSlackMrkdwn(message), unfurl_links: true }, "Slack webhook");
    },
  };
}

export function configuredChannels(env: NodeJS.ProcessEnv = process.env): Channel[] {
  const channels: Channel[] = [];
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) channels.push(telegram(env.TELEGRAM_BOT_TOKEN, env.TELEGRAM_CHAT_ID));
  if (env.SLACK_WEBHOOK_URL) channels.push(slack(env.SLACK_WEBHOOK_URL));
  return channels;
}
