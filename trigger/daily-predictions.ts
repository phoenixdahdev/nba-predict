import { schedules } from "@trigger.dev/sdk";
import { runPlayerPredictions } from "../src/agents/player-predict";
import { runQuickPredictions } from "../src/agents/quick-predict";
import { runDeepAnalysis } from "../src/agents/deep-analyze";
import { insertPrediction, getGameByExternalId } from "../src/db/queries";
import { notifyAllSubscribers } from "../src/bot-handlers/notifications";
import { formatDailyPredictions } from "../src/lib/format";

function todayDate(): string {
  return new Date().toISOString().split("T")[0]!;
}

export const dailyPredictions = schedules.task({
  id: "daily-predictions",
  // 9 AM ET = 14:00 UTC (during EDT) / 14:00 UTC (adjust for EST if needed)
  cron: "0 14 * * *",
  run: async () => {
    const date = todayDate();
    console.log(`[daily-predictions] Running for ${date}`);

    // Run player predictions FIRST — this is the main product
    const playerPreds = await runPlayerPredictions(date);

    // Run quick predictions (moneyline + totals) with Flash model
    const quick = await runQuickPredictions(date);

    // Run deep analysis (spreads + player props) with Pro model
    const deep = await runDeepAnalysis(date);

    if (!quick && !deep && !playerPreds) {
      console.log(
        "[daily-predictions] No games today or no predictions generated",
      );
      return { status: "no_games", date };
    }

    // Store predictions in database
    const stored = {
      moneyline: 0,
      totals: 0,
      spreads: 0,
      playerProps: 0,
      specials: 0,
    };

    // Store player predictions (primary)
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

    // Merge player props from both agents (player-predict is primary, deep is secondary)
    const allPlayerProps = [
      ...(playerPreds?.props ?? []),
      ...(deep?.playerProps ?? []),
    ];

    // Send to all subscribers — player picks first
    const message = formatDailyPredictions({
      date,
      playerProps: allPlayerProps,
      specials: playerPreds?.specials ?? [],
      moneyline: quick?.moneyline ?? [],
      totals: quick?.totals ?? [],
      spreads: deep?.spreads ?? [],
    });

    await notifyAllSubscribers(message);

    console.log(`[daily-predictions] Stored: ${JSON.stringify(stored)}`);
    return { status: "success", date, stored };
  },
});
