import { generateText, Output, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { fetchGamesTool } from "../tools/fetch-games";
import { fetchTeamStatsTool } from "../tools/fetch-team-stats";
import { fetchRecentGamesTool } from "../tools/fetch-recent-games";
import { batchQuickPredictions, type BatchQuickPredictions } from "../lib/schemas";

const SYSTEM_PROMPT = `You are an expert NBA analyst. Your job is to predict game outcomes based on data.

For each game today, generate:
1. **Moneyline** prediction — which team wins
2. **Total** prediction — over/under combined score

Use these factors in your analysis:
- Team records (wins/losses)
- Points per game and opponent PPG
- Recent form (last 5-10 games trend)
- Home/away advantage (home teams win ~58% historically)
- Head-to-head matchup dynamics

Always fetch today's games first, then gather team stats and recent games for each team playing.
Set the total line based on both teams' average PPG combined.
Be specific in reasoning — cite actual numbers.
Confidence should reflect how clear the edge is (0.5 = coin flip, 0.9 = very strong).`;

export async function runQuickPredictions(
  date: string
): Promise<BatchQuickPredictions | null> {
  const { text } = await generateText({
    model: google("gemini-2.5-flash"),
    system: SYSTEM_PROMPT,
    prompt: `Analyze all NBA games for ${date}. First fetch the games, then gather team stats and recent games for each team. Finally, generate moneyline and total predictions for every game.`,
    tools: {
      fetchGames: fetchGamesTool,
      fetchTeamStats: fetchTeamStatsTool,
      fetchRecentGames: fetchRecentGamesTool,
    },
    stopWhen: stepCountIs(15),
  });

  // Now generate structured output from the analysis
  const { output } = await generateText({
    model: google("gemini-2.5-flash"),
    output: Output.object({ schema: batchQuickPredictions }),
    prompt: `Based on this analysis, generate structured predictions:\n\n${text}\n\nReturn moneyline and total predictions for each game on ${date}.`,
  });

  return output;
}
