import { cacheLife } from "next/cache";
import { siteConfig } from "@/config/site";
import { dayKey, nowInMadrid } from "@/lib/dates";
import { getLeagues, getTeam, getTeamMatches } from "@/lib/data";
import { championsStage } from "@/lib/sportspress/champions";
import { LeagueTree } from "@/lib/sportspress/leagues";
import { callUpMessage, fingerprint, type CallUpMessage } from "@/notify/call-ups";

/**
 * The example call-up on the Slack bot's page (/slack): the focus team's next
 * match, or its last one between seasons, as the bot would announce it.
 */
export async function getSlackExample(): Promise<CallUpMessage | null> {
  "use cache";
  cacheLife("results");

  const team = await getTeam(siteConfig.focusTeamSlug);
  if (!team) return null;
  const matches = await getTeamMatches(team.id);
  const today = dayKey(nowInMadrid());
  const match = matches.find((m) => !m.played && dayKey(m.date) >= today) ?? matches.findLast((m) => m.played);
  if (!match) return null;
  const tree = new LeagueTree(await getLeagues());
  return callUpMessage({ match, kind: "new", fingerprint: fingerprint(match) }, team.id, today, championsStage(match, tree));
}
