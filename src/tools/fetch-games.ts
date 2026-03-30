import { tool } from "ai";
import { z } from "zod";
import { balldontlie } from "../data/balldontlie";
import { getGamesByDate, upsertGame, upsertTeam, getTeamByExternalId } from "../db/queries";

async function ensureTeam(bdlTeam: { id: number; abbreviation: string; city: string; name: string; conference: string; division: string }) {
  let team = await getTeamByExternalId(bdlTeam.id);
  if (!team) {
    team = await upsertTeam({
      externalId: bdlTeam.id,
      abbreviation: bdlTeam.abbreviation,
      city: bdlTeam.city,
      name: bdlTeam.name,
      conference: bdlTeam.conference,
      division: bdlTeam.division,
    });
  }
  return team;
}

export const fetchGamesTool = tool({
  description:
    "Fetch NBA games for a specific date. Returns games with teams, scores, and status. Data is cached in the database.",
  inputSchema: z.object({
    date: z.string().describe("Date in YYYY-MM-DD format"),
  }),
  execute: async ({ date }) => {
    // Check cache first
    const cached = await getGamesByDate(date);
    if (cached.length > 0) {
      return { source: "cache", games: cached };
    }

    // Fetch from API
    const apiGames = await balldontlie.getGames(date);

    const storedGames = [];
    for (const g of apiGames) {
      const homeTeam = await ensureTeam(g.home_team);
      const awayTeam = await ensureTeam(g.visitor_team);

      const game = await upsertGame({
        externalId: g.id,
        homeTeamId: homeTeam.id,
        awayTeamId: awayTeam.id,
        gameDate: date,
        status: g.status === "Final" ? "final" : "scheduled",
        homeScore: g.home_team_score || null,
        awayScore: g.visitor_team_score || null,
      });

      storedGames.push({
        ...game,
        homeTeamAbbr: g.home_team.abbreviation,
        awayTeamAbbr: g.visitor_team.abbreviation,
      });
    }

    return { source: "api", games: storedGames };
  },
});
