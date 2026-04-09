import type { Chat, Message, Thread } from "chat";
import {
  upsertSubscriber,
  deactivateSubscriber,
  getPredictionsByDate,
} from "../db/queries";
import { formatDailyPredictions } from "../lib/format";

function todayDate(): string {
  return new Date().toISOString().split("T")[0]!;
}

// Track active runs per user (chatId → { runId, taskName, date, startedAt })
const activeRuns = new Map<
  string,
  Array<{ runId: string; task: string; date: string; startedAt: Date }>
>();

function trackRun(chatId: string, runId: string, task: string, date: string) {
  const runs = activeRuns.get(chatId) ?? [];
  runs.push({ runId, task, date, startedAt: new Date() });
  // Keep only last 5 runs per user
  if (runs.length > 5) runs.shift();
  activeRuns.set(chatId, runs);
}

function formatStatus(status: string): string {
  switch (status) {
    case "QUEUED":
      return "⏳ Queued";
    case "EXECUTING":
      return "🔄 Running";
    case "COMPLETED":
      return "✅ Completed";
    case "FAILED":
      return "❌ Failed";
    case "CANCELED":
      return "🚫 Canceled";
    case "REATTEMPTING":
      return "🔁 Retrying";
    case "FROZEN":
      return "🧊 Frozen";
    default:
      return `⏺ ${status}`;
  }
}

function elapsed(startedAt: Date): string {
  const sec = Math.floor((Date.now() - startedAt.getTime()) / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${min}m ${remSec}s`;
}

async function handleCommand(thread: Thread, message: Message) {
  const text = message.text?.trim() ?? "";

  // /start or /subscribe
  if (/^\/(start|subscribe)$/i.test(text)) {
    const chatId = thread.id;
    const name =
      message.author?.fullName ?? message.author?.userName ?? "NBA Fan";

    await upsertSubscriber({
      platformId: `telegram:${chatId}`,
      displayName: name,
    });

    await thread.post(
      `🏀 Welcome to NBA Predict!\n\n` +
        `You're now subscribed to daily predictions.\n\n` +
        `*Commands:*\n` +
        `/today — Today's predictions\n` +
        `/repredict — Tomorrow's predictions\n` +
        `/repredict 2026-04-01 — Predictions for any date\n` +
        `/predict LAL — On-demand team prediction\n` +
        `/status — Check running predictions\n` +
        `/accuracy — Prediction accuracy stats\n` +
        `/unsubscribe — Stop receiving predictions`
    );
    return;
  }

  // /unsubscribe
  if (/^\/unsubscribe$/i.test(text)) {
    await deactivateSubscriber(`telegram:${thread.id}`);
    await thread.post(
      "You've been unsubscribed. Send /start to resubscribe anytime."
    );
    return;
  }

  // /status — check running predictions
  if (/^\/status$/i.test(text)) {
    const chatId = thread.id;
    const runs = activeRuns.get(chatId);

    if (!runs || runs.length === 0) {
      await thread.post("No recent prediction runs. Use /repredict or /predict to start one.");
      return;
    }

    try {
      const { runs: runsApi } = await import("@trigger.dev/sdk/v3");

      const lines = ["📋 *Your Prediction Runs*\n"];

      for (const run of runs) {
        try {
          const details = await runsApi.retrieve(run.runId);
          const status = formatStatus(details.status);
          lines.push(
            `${status} *${run.task}* (${run.date})\n` +
              `  Started: ${elapsed(run.startedAt)} ago` +
              (details.status === "COMPLETED" ? ` ✓` : "")
          );
        } catch {
          lines.push(
            `⏺ *${run.task}* (${run.date})\n` +
              `  Started: ${elapsed(run.startedAt)} ago — status unknown`
          );
        }
      }

      await thread.post(lines.join("\n"));
    } catch {
      await thread.post("Couldn't fetch run status. Try again later.");
    }
    return;
  }

  // /today
  if (/^\/today$/i.test(text)) {
    const date = todayDate();
    const preds = await getPredictionsByDate(date);

    if (preds.length === 0) {
      await thread.post(
        `No predictions yet for ${date}. They're generated daily before game time.`
      );
      return;
    }

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

    const msg = formatDailyPredictions({
      date,
      playerProps,
      specials,
      moneyline,
      totals,
      spreads,
    });

    await thread.post(msg);
    return;
  }

  // /accuracy
  if (/^\/accuracy$/i.test(text)) {
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
      await thread.post(
        "No graded predictions yet. Check back after games finish!"
      );
      return;
    }

    const lines = ["📊 *Overall Accuracy*\n"];
    for (const s of stats) {
      const pct =
        s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
      lines.push(`*${s.type}*: ${s.correct}/${s.total} (${pct}%)`);
    }

    await thread.post(lines.join("\n"));
    return;
  }

  // /repredict <DATE> — run predictions for a custom date
  const repredictMatch = text.match(
    /^\/repredict(?:\s+(\d{4}-\d{2}-\d{2}))?$/i
  );
  if (repredictMatch) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const date =
      repredictMatch[1] ?? tomorrow.toISOString().split("T")[0]!;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) {
      await thread.post("Invalid date. Usage: /repredict 2026-04-01");
      return;
    }

    await thread.post(
      `🔄 Running predictions for *${date}*... This may take a few minutes.\nUse /status to check progress.`
    );

    try {
      const { tasks } = await import("@trigger.dev/sdk/v3");
      const { repredictTask } = await import("../../trigger/repredict");
      const handle = await tasks.trigger(repredictTask.id, {
        date,
        chatId: thread.id,
      });
      trackRun(thread.id, handle.id, "repredict", date);
    } catch {
      await thread.post("Sorry, couldn't start predictions. Try again later.");
    }
    return;
  }

  // /predict <TEAM>
  const predictMatch = text.match(/^\/predict\s+(\w+)$/i);
  if (predictMatch) {
    const teamAbbr = predictMatch[1]!.toUpperCase();
    await thread.post(
      `🔍 Analyzing ${teamAbbr}... This may take a moment.\nUse /status to check progress.`
    );

    try {
      const { tasks } = await import("@trigger.dev/sdk/v3");
      const { onDemandPredict } = await import(
        "../../trigger/on-demand-predict"
      );
      const handle = await tasks.trigger(onDemandPredict.id, {
        teamAbbr,
        chatId: thread.id,
      });
      trackRun(thread.id, handle.id, "predict", teamAbbr);
    } catch {
      await thread.post("Sorry, couldn't start analysis. Try again later.");
    }
    return;
  }

  // Unknown command
  if (text.startsWith("/")) {
    await thread.post(
      `Unknown command. Try:\n/today — Today's picks\n/repredict — Tomorrow's picks\n/predict LAL — Team prediction\n/status — Check running predictions\n/accuracy — Stats`
    );
    return;
  }

  // Non-command message
  await thread.post(
    "Send a command to get started:\n/start — Subscribe\n/today — Today's picks\n/repredict — Tomorrow's picks\n/predict LAL — Team prediction"
  );
}

export function registerCommands(bot: Chat) {
  bot.onDirectMessage(async (thread, message) => {
    await handleCommand(thread, message);
  });

  bot.onNewMention(async (thread, message) => {
    await handleCommand(thread, message);
  });

  bot.onSubscribedMessage(async (thread, message) => {
    if (message.author?.isMe) return;
    await handleCommand(thread, message);
  });
}
