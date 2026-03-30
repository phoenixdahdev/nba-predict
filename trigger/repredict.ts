import { task } from "@trigger.dev/sdk";
import { runPlayerPredictions } from "../src/agents/player-predict";
import { runQuickPredictions } from "../src/agents/quick-predict";
import { runDeepAnalysis } from "../src/agents/deep-analyze";
import { insertPrediction, getGameByExternalId } from "../src/db/queries";
import { notifyChat } from "../src/bot-handlers/notifications";
import { formatDailyPredictions } from "../src/lib/format";

export const repredictTask = task({
  id: "repredict",
  run: async ({ date, chatId }: { date: string; chatId: string }) => {
    console.log(`[repredict] Running predictions for ${date}`);

    const playerPreds = await runPlayerPredictions(date);
    const quick = await runQuickPredictions(date);
    const deep = await runDeepAnalysis(date);

    if (!quick && !deep && !playerPreds) {
      await notifyChat(chatId, `No NBA games found for ${date}.`);
      return { status: "no_games", date };
    }

    const stored = {
      moneyline: 0,
      totals: 0,
      spreads: 0,
      playerProps: 0,
      specials: 0,
    };

    // Store player predictions
    if (playerPreds) {
      for (const prop of playerPreds.props) {
        const game = await getGameByExternalId(prop.gameExternalId);
        if (game) {
          await insertPrediction({
            gameId: game.id,
            type: "player_prop",
            modelUsed: "google/gemini-2.0-flash",
            prediction: prop,
            confidence: prop.confidence,
            reasoning: prop.reasoning,
          });
          stored.playerProps++;
        }
      }

      for (const special of playerPreds.specials) {
        const game = await getGameByExternalId(special.gameExternalId);
        if (game) {
          await insertPrediction({
            gameId: game.id,
            type: special.type,
            modelUsed: "google/gemini-2.0-flash",
            prediction: special,
            confidence: special.confidence,
            reasoning: special.reasoning,
          });
          stored.specials++;
        }
      }
    }

    // Store game-level predictions
    if (quick) {
      for (const ml of quick.moneyline) {
        const game = await getGameByExternalId(ml.gameExternalId);
        if (game) {
          await insertPrediction({
            gameId: game.id,
            type: "moneyline",
            modelUsed: "google/gemini-2.0-flash",
            prediction: ml,
            confidence: ml.confidence,
            reasoning: ml.reasoning,
          });
          stored.moneyline++;
        }
      }

      for (const total of quick.totals) {
        const game = await getGameByExternalId(total.gameExternalId);
        if (game) {
          await insertPrediction({
            gameId: game.id,
            type: "total",
            modelUsed: "google/gemini-2.0-flash",
            prediction: total,
            confidence: total.confidence,
            reasoning: total.reasoning,
          });
          stored.totals++;
        }
      }
    }

    if (deep) {
      for (const spread of deep.spreads) {
        const game = await getGameByExternalId(spread.gameExternalId);
        if (game) {
          await insertPrediction({
            gameId: game.id,
            type: "spread",
            modelUsed: "google/gemini-2.0-flash",
            prediction: spread,
            confidence: spread.confidence,
            reasoning: spread.reasoning,
          });
          stored.spreads++;
        }
      }

      for (const prop of deep.playerProps) {
        const game = await getGameByExternalId(prop.gameExternalId);
        if (game) {
          await insertPrediction({
            gameId: game.id,
            type: "player_prop",
            modelUsed: "google/gemini-2.0-flash",
            prediction: prop,
            confidence: prop.confidence,
            reasoning: prop.reasoning,
          });
          stored.playerProps++;
        }
      }
    }

    // Merge all player props and send to the requesting user
    const allPlayerProps = [
      ...(playerPreds?.props ?? []),
      ...(deep?.playerProps ?? []),
    ];

    const message = formatDailyPredictions({
      date,
      playerProps: allPlayerProps,
      specials: playerPreds?.specials ?? [],
      moneyline: quick?.moneyline ?? [],
      totals: quick?.totals ?? [],
      spreads: deep?.spreads ?? [],
    });

    await notifyChat(chatId, message);

    console.log(`[repredict] Stored: ${JSON.stringify(stored)}`);
    return { status: "success", date, stored };
  },
});
