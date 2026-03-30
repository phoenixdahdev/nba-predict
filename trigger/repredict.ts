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
    console.log(`[repredict] Starting predictions for ${date}`);

    let playerPreds = null;
    let quick = null;
    let deep = null;

    try {
      console.log(`[repredict] Running player predictions...`);
      playerPreds = await runPlayerPredictions(date);
      console.log(`[repredict] Player predictions done:`, {
        props: playerPreds?.props?.length ?? 0,
        specials: playerPreds?.specials?.length ?? 0,
      });
    } catch (err: any) {
      console.error(`[repredict] Player predictions FAILED:`, err.message);
      await notifyChat(chatId, `⚠️ Player predictions failed: ${err.message}`);
    }

    try {
      console.log(`[repredict] Running quick predictions...`);
      quick = await runQuickPredictions(date);
      console.log(`[repredict] Quick predictions done:`, {
        moneyline: quick?.moneyline?.length ?? 0,
        totals: quick?.totals?.length ?? 0,
      });
    } catch (err: any) {
      console.error(`[repredict] Quick predictions FAILED:`, err.message);
      await notifyChat(chatId, `⚠️ Quick predictions failed: ${err.message}`);
    }

    try {
      console.log(`[repredict] Running deep analysis...`);
      deep = await runDeepAnalysis(date);
      console.log(`[repredict] Deep analysis done:`, {
        spreads: deep?.spreads?.length ?? 0,
        playerProps: deep?.playerProps?.length ?? 0,
      });
    } catch (err: any) {
      console.error(`[repredict] Deep analysis FAILED:`, err.message);
      await notifyChat(chatId, `⚠️ Deep analysis failed: ${err.message}`);
    }

    if (!quick && !deep && !playerPreds) {
      await notifyChat(chatId, `No NBA games found for ${date}, or all agents failed.`);
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
            modelUsed: "google/gemini-2.5",
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
            modelUsed: "google/gemini-2.5",
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
            modelUsed: "google/gemini-2.5",
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
            modelUsed: "google/gemini-2.5",
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
            modelUsed: "google/gemini-2.5",
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
            modelUsed: "google/gemini-2.5",
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
