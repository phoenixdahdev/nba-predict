import { generateText, Output, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { fetchGamesTool } from "../tools/fetch-games";
import { fetchPlayerStatsTool } from "../tools/fetch-player-stats";
import { fetchTeamStatsTool } from "../tools/fetch-team-stats";
import { fetchRecentGamesTool } from "../tools/fetch-recent-games";
import { batchDeepPredictions, type BatchDeepPredictions } from "../lib/schemas";

const SYSTEM_PROMPT = `You are a senior NBA analytics expert specializing in spread predictions and player props.

For **spreads**, analyze:
- Point differentials in recent games
- Home/away performance splits
- Pace matchup (fast vs slow teams)
- Back-to-back game fatigue
- Key player availability impact

For **player props**, focus on the top 2-3 players per game:
- Season averages vs recent 5-game trends
- Matchup advantages (e.g., big man vs weak interior defense)
- Usage rate changes when teammates are out
- Home/away stat splits
- Minutes trends

Pick the most confident player prop lines. Focus on points, assists, and rebounds.
Use specific numbers in reasoning. Be conservative with confidence — this is harder to predict than moneyline.`;

export async function runDeepAnalysis(
  date: string
): Promise<BatchDeepPredictions | null> {
  console.log(`[deep-analyze] Step 1: Gathering data for ${date}...`);
  const { text, steps } = await generateText({
    model: google("gemini-2.5-pro"),
    system: SYSTEM_PROMPT,
    prompt: `Perform deep analysis on all NBA games for ${date}. Fetch games, team stats, player stats, and recent form. Generate spread predictions and player prop predictions for key players.`,
    tools: {
      fetchGames: fetchGamesTool,
      fetchPlayerStats: fetchPlayerStatsTool,
      fetchTeamStats: fetchTeamStatsTool,
      fetchRecentGames: fetchRecentGamesTool,
    },
    stopWhen: stepCountIs(10),
  });

  console.log(`[deep-analyze] Step 1 done. ${steps.length} steps, ${text.length} chars.`);
  console.log(`[deep-analyze] Step 2: Generating structured output...`);
  const { output } = await generateText({
    model: google("gemini-2.5-pro"),
    output: Output.object({ schema: batchDeepPredictions }),
    prompt: `Based on this deep analysis, generate structured spread and player prop predictions:\n\n${text}\n\nReturn spread predictions for each game and player prop predictions for the top players on ${date}.`,
  });

  console.log(`[deep-analyze] Done. Spreads: ${output?.spreads?.length ?? 0}, Props: ${output?.playerProps?.length ?? 0}`);
  return output;
}
