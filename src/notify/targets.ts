// Who gets which call-ups. A target is a channel following one team: the
// env-configured ones follow the focus team, each Slack subscription its own.
// Kept apart from run.ts so it can be tested.

import type { Match } from "@/lib/sportspress/types";
import { pendingCallUps, type CallUp } from "./call-ups";
import type { Schedule } from "./schedule";

export interface Target {
  /** Its key in `notifications.channel`: "telegram", "slack" or "sub:<id>". */
  key: string;
  teamId: number;
  /** When a subscription wants its call-ups; none for the env-configured channels. */
  schedule?: Schedule | null;
}

export const subscriptionKey = (id: number) => `sub:${id}`;

export interface SentRow {
  matchId: number;
  channel: string;
  fingerprint: string;
}

/**
 * Each target's pending call-ups: the matches of its team it has not announced
 * (or that changed since), soonest first. `matches` holds the upcoming matches
 * of every followed team, loaded in one query.
 */
export function pendingByTarget<T extends Target>(targets: T[], matches: Match[], sent: SentRow[], now: string): { target: T; callUps: CallUp[] }[] {
  const sentBy = new Map<string, Map<number, string>>();
  for (const row of sent) {
    if (!sentBy.has(row.channel)) sentBy.set(row.channel, new Map());
    sentBy.get(row.channel)!.set(row.matchId, row.fingerprint);
  }
  return targets.map((target) => {
    const own = matches.filter((m) => m.homeId === target.teamId || m.awayId === target.teamId);
    return { target, callUps: pendingCallUps(own, sentBy.get(target.key) ?? new Map(), now, target.schedule ?? null) };
  });
}

/**
 * Slack's answers that mean an Incoming Webhook will never work again: the app
 * was removed, the channel deleted or archived, the workspace closed. Anything
 * else (a 5xx, a rate limit) is worth retrying on the next run.
 * https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks#handling-errors
 */
const REVOKED = new Set(["no_service", "no_team", "team_disabled", "invalid_token", "channel_not_found", "channel_is_archived"]);

export function isRevokedWebhook(status: number, body: string): boolean {
  return status >= 400 && status < 500 && REVOKED.has(body.trim());
}
