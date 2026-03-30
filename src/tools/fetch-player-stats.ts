import { tool } from "ai";
import { z } from "zod";
import { balldontlie } from "../data/balldontlie";
import {
  getSeasonAverage,
  upsertSeasonAverage,
  getPlayerRecentStats,
} from "../db/queries";

export const fetchPlayerStatsTool = tool({
  description:
    "Fetch a player's season averages and recent game stats. Checks database cache first, fetches from API if stale (>24h) or missing.",
  inputSchema: z.object({
    playerExternalId: z.number().describe("balldontlie player ID"),
    playerId: z.number().describe("Internal database player ID"),
    season: z.number().describe("NBA season year (e.g. 2025)"),
  }),
  execute: async ({ playerExternalId, playerId, season }) => {
    // Check cached season averages
    let avg = await getSeasonAverage(playerId, season);
    const isStale =
      avg && Date.now() - avg.updatedAt.getTime() > 24 * 60 * 60 * 1000;

    if (!avg || isStale) {
      // Fetch from API
      const apiAvgs = await balldontlie.getSeasonAverages(
        [playerExternalId],
        season
      );
      if (apiAvgs.length > 0) {
        const a = apiAvgs[0]!;
        avg = await upsertSeasonAverage({
          playerId,
          season,
          gamesPlayed: a.games_played,
          pts: a.pts,
          reb: a.reb,
          ast: a.ast,
          stl: a.stl,
          blk: a.blk,
          fgPct: a.fg_pct,
          fg3Pct: a.fg3_pct,
          ftPct: a.ft_pct,
          turnovers: a.turnover,
        });
      }
    }

    // Get recent game stats from cache
    const recentStats = await getPlayerRecentStats(playerId, 5);

    return {
      seasonAverages: avg,
      recentGames: recentStats,
    };
  },
});
