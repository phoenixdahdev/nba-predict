import { schedules } from "@trigger.dev/sdk";
import { balldontlie } from "../src/data/balldontlie";
import {
  getGamesByDate,
  upsertGame,
  getUngradedPredictions,
  gradePrediction,
  upsertAccuracySnapshot,
  getTeamByExternalId,
} from "../src/db/queries";
import { notifyAllSubscribers } from "../src/bot-handlers/notifications";
import { formatAccuracyReport } from "../src/lib/format";
import type {
  MoneylinePrediction,
  TotalPrediction,
  SpreadPrediction,
  PlayerPropPrediction,
} from "../src/lib/schemas";

function todayDate(): string {
  // Check yesterday's games (post-game runs at 1 AM)
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0]!;
}

function gradeMoneyline(
  pred: MoneylinePrediction,
  homeScore: number,
  awayScore: number,
  homeTeamAbbr: string,
): "correct" | "incorrect" | "push" {
  if (homeScore === awayScore) return "push";
  const winner = homeScore > awayScore ? homeTeamAbbr : pred.awayTeam;
  return pred.pick === winner ? "correct" : "incorrect";
}

function gradeTotal(
  pred: TotalPrediction,
  homeScore: number,
  awayScore: number,
): "correct" | "incorrect" | "push" {
  const actual = homeScore + awayScore;
  if (actual === pred.line) return "push";
  const actualResult = actual > pred.line ? "over" : "under";
  return pred.pick === actualResult ? "correct" : "incorrect";
}

function gradeSpread(
  pred: SpreadPrediction,
  homeScore: number,
  awayScore: number,
  homeTeamAbbr: string,
): "correct" | "incorrect" | "push" {
  const margin = homeScore - awayScore;
  // If favorite is home team, spread is negative (e.g., -5.5)
  const isFavoriteHome = pred.favorite === homeTeamAbbr;
  const adjustedMargin = isFavoriteHome ? margin : -margin;
  const covered = adjustedMargin + pred.spread > 0;

  if (adjustedMargin + pred.spread === 0) return "push";
  const coverTeam = covered
    ? pred.favorite
    : pred.favorite === pred.homeTeam
      ? pred.awayTeam
      : pred.homeTeam;
  return pred.pick === coverTeam ? "correct" : "incorrect";
}

export const postGameCheck = schedules.task({
  id: "post-game-check",
  // 1 AM ET = 06:00 UTC
  cron: "0 6 * * *",
  run: async () => {
    const date = todayDate();
    console.log(`[post-game-check] Checking results for ${date}`);

    // Get games for the date
    const cachedGames = await getGamesByDate(date);
    const results: Record<string, { total: number; correct: number }> = {
      moneyline: { total: 0, correct: 0 },
      total: { total: 0, correct: 0 },
      spread: { total: 0, correct: 0 },
      player_prop: { total: 0, correct: 0 },
    };

    for (const game of cachedGames) {
      // Refresh game data from API to get final scores
      try {
        const apiGame = await balldontlie.getGameById(game.externalId);
        if (apiGame.status !== "Final") continue;

        // Update game with final scores
        await upsertGame({
          externalId: game.externalId,
          homeTeamId: game.homeTeamId,
          awayTeamId: game.awayTeamId,
          gameDate: date,
          status: "final",
          homeScore: apiGame.home_team_score,
          awayScore: apiGame.visitor_team_score,
        });

        const homeScore = apiGame.home_team_score;
        const awayScore = apiGame.visitor_team_score;
        const homeTeamAbbr = apiGame.home_team.abbreviation;

        // Grade all predictions for this game
        const ungraded = await getUngradedPredictions(game.id);

        for (const pred of ungraded) {
          let result: "correct" | "incorrect" | "push";
          const data = pred.prediction as any;

          switch (pred.type) {
            case "moneyline":
              result = gradeMoneyline(data, homeScore, awayScore, homeTeamAbbr);
              break;
            case "total":
              result = gradeTotal(data, homeScore, awayScore);
              break;
            case "spread":
              result = gradeSpread(data, homeScore, awayScore, homeTeamAbbr);
              break;
            case "player_prop":
              // Player props need actual player stats — skip for now if not available
              // TODO: fetch player box score stats and grade
              continue;
            default:
              continue;
          }

          await gradePrediction(pred.id, result);

          const typeKey = pred.type;
          if (results[typeKey]) {
            results[typeKey].total++;
            if (result === "correct") results[typeKey].correct++;
          }
        }
      } catch (err) {
        console.error(
          `[post-game-check] Error processing game ${game.externalId}:`,
          err,
        );
      }
    }

    // Store accuracy snapshot
    for (const [type, data] of Object.entries(results)) {
      if (data.total === 0) continue;
      await upsertAccuracySnapshot({
        periodType: "daily",
        periodStart: date,
        predictionType: type,
        totalPicks: data.total,
        correctPicks: data.correct,
        accuracyPct:
          data.total > 0
            ? Math.round((data.correct / data.total) * 1000) / 10
            : null,
      });
    }

    // Send report to subscribers
    const reportData = Object.entries(results)
      .filter(([_, d]) => d.total > 0)
      .map(([type, d]) => ({ type, ...d }));

    if (reportData.length > 0) {
      const report = formatAccuracyReport({ date, results: reportData });
      await notifyAllSubscribers(report);
    }

    console.log(`[post-game-check] Results: ${JSON.stringify(results)}`);
    return { status: "success", date, results };
  },
});
