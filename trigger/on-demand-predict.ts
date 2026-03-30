import { task } from "@trigger.dev/sdk";
import { generateText, Output, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { fetchGamesTool } from "../src/tools/fetch-games";
import { fetchPlayerStatsTool } from "../src/tools/fetch-player-stats";
import { fetchTeamStatsTool } from "../src/tools/fetch-team-stats";
import { fetchRecentGamesTool } from "../src/tools/fetch-recent-games";
import {
  getTeamByAbbreviation,
  getGameByExternalId,
  insertPrediction,
} from "../src/db/queries";
import { notifyChat } from "../src/bot-handlers/notifications";
import { formatMoneyline, formatTotal, formatSpread } from "../src/lib/format";
import {
  moneylinePrediction,
  totalPrediction,
  spreadPrediction,
} from "../src/lib/schemas";

const onDemandSchema = z.object({
  moneyline: moneylinePrediction,
  total: totalPrediction,
  spread: spreadPrediction,
});

export const onDemandPredict = task({
  id: "on-demand-predict",
  run: async ({ teamAbbr, chatId }: { teamAbbr: string; chatId: string }) => {
    const date = new Date().toISOString().split("T")[0]!;

    // Get the team's game today
    const { text } = await generateText({
      model: google("gemini-2.0-flash"),
      system: `You are an NBA analyst. Find and analyze the game for team ${teamAbbr} on ${date}. Fetch game data, team stats, and recent form. Provide a complete prediction.`,
      prompt: `Analyze ${teamAbbr}'s game on ${date}. Fetch the games for today, then get team stats and recent games for both teams in the matchup.`,
      tools: {
        fetchGames: fetchGamesTool,
        fetchTeamStats: fetchTeamStatsTool,
        fetchRecentGames: fetchRecentGamesTool,
      },
      stopWhen: stepCountIs(10),
    });

    // Generate structured prediction
    const { output } = await generateText({
      model: google("gemini-2.0-flash"),
      output: Output.object({ schema: onDemandSchema }),
      prompt: `Based on this analysis for ${teamAbbr} on ${date}:\n\n${text}\n\nGenerate moneyline, total, and spread predictions.`,
    });

    if (!output) {
      await notifyChat(chatId, `Could not find a game for ${teamAbbr} today.`);
      return { status: "no_game" };
    }

    // Store predictions
    const game = await getGameByExternalId(output.moneyline.gameExternalId);
    if (game) {
      for (const [type, pred] of [
        ["moneyline", output.moneyline],
        ["total", output.total],
        ["spread", output.spread],
      ] as const) {
        await insertPrediction({
          gameId: game.id,
          type,
          modelUsed: "google/gemini-2.0-flash",
          prediction: pred,
          confidence: pred.confidence,
          reasoning: pred.reasoning,
        });
      }
    }

    // Send back to user
    const message = [
      `🏀 *${teamAbbr} Prediction — ${date}*\n`,
      "*── MONEYLINE ──*",
      formatMoneyline(output.moneyline),
      "",
      "*── TOTAL ──*",
      formatTotal(output.total),
      "",
      "*── SPREAD ──*",
      formatSpread(output.spread),
    ].join("\n");

    await notifyChat(chatId, message);

    return { status: "success", teamAbbr };
  },
});
