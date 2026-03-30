import { tool } from "ai";
import { z } from "zod";
import { getTeamStats, upsertTeamStats, getTeamByExternalId } from "../db/queries";
import { balldontlie } from "../data/balldontlie";

export const fetchTeamStatsTool = tool({
  description:
    "Fetch team stats for a season (wins, losses, PPG, opponent PPG, pace, ratings). Cached in database, refreshed if >24h stale.",
  inputSchema: z.object({
    teamExternalId: z.number().describe("balldontlie team ID"),
    teamId: z.number().describe("Internal database team ID"),
    season: z.number().describe("NBA season year"),
  }),
  execute: async ({ teamExternalId, teamId, season }) => {
    // Check cache
    let stats = await getTeamStats(teamId, season);
    const isStale =
      stats && Date.now() - stats.updatedAt.getTime() > 24 * 60 * 60 * 1000;

    if (!stats || isStale) {
      // Fetch recent games to compute team stats
      const recentGames = await balldontlie.getRecentGames(
        teamExternalId,
        season,
        100
      );

      let wins = 0;
      let losses = 0;
      let totalPts = 0;
      let totalOppPts = 0;
      let gamesCount = 0;

      for (const g of recentGames) {
        if (g.status !== "Final") continue;
        gamesCount++;

        const isHome = g.home_team.id === teamExternalId;
        const teamScore = isHome ? g.home_team_score : g.visitor_team_score;
        const oppScore = isHome ? g.visitor_team_score : g.home_team_score;

        totalPts += teamScore;
        totalOppPts += oppScore;

        if (teamScore > oppScore) wins++;
        else losses++;
      }

      const ppg = gamesCount > 0 ? totalPts / gamesCount : 0;
      const oppPpg = gamesCount > 0 ? totalOppPts / gamesCount : 0;

      stats = await upsertTeamStats({
        teamId,
        season,
        wins,
        losses,
        ppg: Math.round(ppg * 10) / 10,
        oppPpg: Math.round(oppPpg * 10) / 10,
        pace: null, // Not available from free tier
        offRating: null,
        defRating: null,
      });
    }

    return stats;
  },
});
