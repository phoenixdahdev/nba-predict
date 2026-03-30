import type { Chat } from "chat";
import {
  upsertSubscriber,
  deactivateSubscriber,
  getPredictionsByDate,
  getActiveSubscribers,
} from "../db/queries";
import { formatDailyPredictions } from "../lib/format";

function todayDate(): string {
  return new Date().toISOString().split("T")[0]!;
}

export function registerCommands(bot: Chat) {
  // /start or first DM — subscribe the user
  bot.onNewMessage(/^\/(start|subscribe)$/i, async (thread, message) => {
    const chatId = thread.id;
    const name = message.author?.fullName ?? message.author?.userName ?? "NBA Fan";

    await upsertSubscriber({
      platformId: `telegram:${chatId}`,
      displayName: name,
    });

    await thread.post(
      `🏀 Welcome to NBA Predict!\n\n` +
        `You're now subscribed to daily predictions.\n\n` +
        `*Commands:*\n` +
        `/today — Today's predictions\n` +
        `/accuracy — Prediction accuracy stats\n` +
        `/unsubscribe — Stop receiving predictions\n` +
        `/predict <TEAM> — On-demand prediction for a team`
    );
  });

  // Unsubscribe
  bot.onNewMessage(/^\/unsubscribe$/i, async (thread) => {
    await deactivateSubscriber(`telegram:${thread.id}`);
    await thread.post(
      "You've been unsubscribed. Send /start to resubscribe anytime."
    );
  });

  // Today's predictions
  bot.onNewMessage(/^\/today$/i, async (thread) => {
    const date = todayDate();
    const preds = await getPredictionsByDate(date);

    if (preds.length === 0) {
      await thread.post(
        `No predictions yet for ${date}. They're generated daily before game time.`
      );
      return;
    }

    // Group predictions by type — player picks first
    const playerProps = preds
      .filter((p) => p.type === "player_prop")
      .map((p) => p.prediction as any);
    const specials = preds
      .filter((p) => p.type === "double_double" || p.type === "triple_double")
      .map((p) => p.prediction as any);
    const moneyline = preds
      .filter((p) => p.type === "moneyline")
      .map((p) => p.prediction as any);
    const totals = preds
      .filter((p) => p.type === "total")
      .map((p) => p.prediction as any);
    const spreads = preds
      .filter((p) => p.type === "spread")
      .map((p) => p.prediction as any);

    const message = formatDailyPredictions({
      date,
      playerProps,
      specials,
      moneyline,
      totals,
      spreads,
    });

    await thread.post(message);
  });

  // Accuracy stats
  bot.onNewMessage(/^\/accuracy$/i, async (thread) => {
    // Import dynamically to avoid circular deps
    const { db } = await import("../db");
    const { predictions } = await import("../db/schema");
    const { isNotNull, sql } = await import("drizzle-orm");

    const stats = await db
      .select({
        type: predictions.type,
        total: sql<number>`count(*)`,
        correct: sql<number>`count(*) filter (where ${predictions.result} = 'correct')`,
      })
      .from(predictions)
      .where(isNotNull(predictions.result))
      .groupBy(predictions.type);

    if (stats.length === 0) {
      await thread.post("No graded predictions yet. Check back after games finish!");
      return;
    }

    const lines = ["📊 *Overall Accuracy*\n"];
    for (const s of stats) {
      const pct =
        s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
      lines.push(`*${s.type}*: ${s.correct}/${s.total} (${pct}%)`);
    }

    await thread.post(lines.join("\n"));
  });

  // On-demand prediction for a specific team
  bot.onNewMessage(/^\/predict\s+(\w+)$/i, async (thread, message) => {
    const teamAbbr = message.text?.match(/^\/predict\s+(\w+)$/i)?.[1];
    if (!teamAbbr) {
      await thread.post("Usage: /predict LAL (use team abbreviation)");
      return;
    }

    await thread.post(
      `🔍 Analyzing ${teamAbbr.toUpperCase()}... This may take a moment.`
    );

    // Trigger the on-demand prediction via Trigger.dev
    try {
      const { tasks } = await import("@trigger.dev/sdk/v3");
      const { onDemandPredict } = await import(
        "../../trigger/on-demand-predict"
      );
      await tasks.trigger(onDemandPredict.id, {
        teamAbbr: teamAbbr.toUpperCase(),
        chatId: thread.id,
      });
    } catch (err) {
      await thread.post(
        `Sorry, couldn't start analysis. Try again later.`
      );
    }
  });

  // Catch-all for unknown commands
  bot.onNewMessage(/^\//, async (thread, message) => {
    const knownCommands = ["/start", "/subscribe", "/unsubscribe", "/today", "/accuracy", "/predict"];
    const cmd = message.text?.split(" ")[0]?.toLowerCase();
    if (cmd && knownCommands.some((k) => cmd === k)) return; // handled above

    await thread.post(
      `Unknown command. Try:\n/today — Today's predictions\n/accuracy — Stats\n/predict LAL — Team prediction`
    );
  });
}
