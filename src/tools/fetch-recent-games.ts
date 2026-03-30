import { tool } from "ai";
import { z } from "zod";
import { balldontlie } from "../data/balldontlie";
import { upsertGame, getTeamByExternalId } from "../db/queries";

export const fetchRecentGamesTool = tool({
  description:
    "Fetch a team's recent game results for trend analysis. Returns the last N games with scores. Games are cached in the database.",
  inputSchema: z.object({
    teamExternalId: z.number().describe("balldontlie team ID"),
    season: z.number().describe("NBA season year"),
    limit: z.number().default(10).describe("Number of recent games to fetch"),
  }),
  execute: async ({ teamExternalId, season, limit }) => {
    const apiGames = await balldontlie.getRecentGames(
      teamExternalId,
      season,
      limit
    );

    const results = [];
    for (const g of apiGames) {
      const homeTeam = await getTeamByExternalId(g.home_team.id);
      const awayTeam = await getTeamByExternalId(g.visitor_team.id);

      if (homeTeam && awayTeam) {
        await upsertGame({
          externalId: g.id,
          homeTeamId: homeTeam.id,
          awayTeamId: awayTeam.id,
          gameDate: g.date.split("T")[0]!,
          status: g.status === "Final" ? "final" : "scheduled",
          homeScore: g.home_team_score || null,
          awayScore: g.visitor_team_score || null,
        });
      }

      const isHome = g.home_team.id === teamExternalId;
      const teamScore = isHome ? g.home_team_score : g.visitor_team_score;
      const oppScore = isHome ? g.visitor_team_score : g.home_team_score;

      results.push({
        gameId: g.id,
        date: g.date,
        opponent: isHome
          ? g.visitor_team.abbreviation
          : g.home_team.abbreviation,
        homeAway: isHome ? "home" : "away",
        teamScore,
        opponentScore: oppScore,
        result: teamScore > oppScore ? "W" : "L",
        totalPoints: g.home_team_score + g.visitor_team_score,
      });
    }

    return { team: teamExternalId, recentGames: results };
  },
});
