import { generateText, Output, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { fetchGamesTool } from "../tools/fetch-games";
import { fetchPlayerStatsTool } from "../tools/fetch-player-stats";
import { fetchTeamStatsTool } from "../tools/fetch-team-stats";
import { fetchRecentGamesTool } from "../tools/fetch-recent-games";
import {
  batchPlayerPredictions,
  type BatchPlayerPredictions,
} from "../lib/schemas";

const SYSTEM_PROMPT = `You are an elite NBA player performance analyst. Your ONLY job is predicting individual player stat lines with the HIGHEST possible accuracy.

For each game today, identify the top 3-5 players per game and predict their individual stats:
- **Points** — scoring average, recent trend, matchup vs opponent's defense
- **Assists** — playmaking role, pace of game, opponent's turnover rate
- **Rebounds** — position, team rebounding strategy, opponent's size
- **Steals** — defensive activity, opponent's turnover tendency
- **Blocks** — shot-blocking ability, opponent's paint scoring
- **3-pointers made** — 3PT shooting %, volume, opponent's perimeter defense

Also identify players likely to record:
- **Double-double** — project at least 2 stat categories reaching 10+
- **Triple-double** — project at least 3 stat categories reaching 10+

ANALYSIS METHODOLOGY:
1. Fetch today's games first
2. For each game, fetch team stats for both teams
3. Fetch player season averages and recent games for key players
4. Compare season averages vs last 5 games to spot hot/cold streaks
5. Factor in matchup: opponent's defensive weaknesses in each stat category
6. Factor in home/away splits — players often score more at home
7. Factor in rest days — back-to-backs reduce production

CONFIDENCE GUIDELINES:
- 0.85+ = Strong edge (clear trend + favorable matchup + high volume)
- 0.70-0.84 = Good edge (solid trend OR favorable matchup)
- 0.55-0.69 = Slight edge (mixed signals)
- Below 0.55 = Don't include it — only output HIGH confidence picks

ONLY output predictions where confidence >= 0.60. Quality over quantity.
Set prop lines based on the player's season average for that stat.`;

export async function runPlayerPredictions(
  date: string
): Promise<BatchPlayerPredictions | null> {
  // Step 1: Gather data via tool loop
  const { text } = await generateText({
    model: google("gemini-2.0-flash"),
    system: SYSTEM_PROMPT,
    prompt: `Analyze ALL NBA games for ${date}. For each game:
1. Fetch the games
2. Fetch team stats for both teams
3. Identify the top 3-5 players per game (stars + hot streaks)
4. Fetch their season averages and recent stats
5. Analyze matchups and produce your analysis

Focus on players most likely to hit specific stat thresholds with high confidence.`,
    tools: {
      fetchGames: fetchGamesTool,
      fetchPlayerStats: fetchPlayerStatsTool,
      fetchTeamStats: fetchTeamStatsTool,
      fetchRecentGames: fetchRecentGamesTool,
    },
    stopWhen: stepCountIs(25),
  });

  // Step 2: Generate structured predictions from the analysis
  const { output } = await generateText({
    model: google("gemini-2.0-flash"),
    output: Output.object({ schema: batchPlayerPredictions }),
    prompt: `Based on this player analysis, generate structured predictions.

RULES:
- Only include predictions with confidence >= 0.60
- Set the "line" to the player's season average for that stat (rounded to nearest 0.5)
- For double-doubles: project all 5 stat categories, flag if 2+ are projected >= 10
- For triple-doubles: project all 5 stat categories, flag if 3+ are projected >= 10
- Sort by confidence (highest first)

Analysis:
${text}

Generate player prop predictions and special predictions (double-double/triple-double) for ${date}.`,
  });

  return output;
}
