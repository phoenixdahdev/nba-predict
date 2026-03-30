import { db } from "./index";
import {
  teams,
  players,
  games,
  playerStats,
  seasonAverages,
  teamStats,
  predictions,
  subscribers,
  accuracySnapshots,
} from "./schema";
import { eq, and, sql, inArray, isNull } from "drizzle-orm";

// ─── Teams ───

export async function upsertTeam(team: {
  externalId: number;
  abbreviation: string;
  city: string;
  name: string;
  conference: string;
  division: string;
}) {
  const [row] = await db
    .insert(teams)
    .values(team)
    .onConflictDoUpdate({
      target: teams.externalId,
      set: { ...team, updatedAt: new Date() },
    })
    .returning();
  return row!;
}

export async function getTeamByExternalId(externalId: number) {
  const [row] = await db
    .select()
    .from(teams)
    .where(eq(teams.externalId, externalId));
  return row;
}

export async function getTeamByAbbreviation(abbreviation: string) {
  const [row] = await db
    .select()
    .from(teams)
    .where(eq(teams.abbreviation, abbreviation.toUpperCase()));
  return row;
}

export async function getAllTeams() {
  return db.select().from(teams);
}

// ─── Players ───

export async function upsertPlayer(player: {
  externalId: number;
  firstName: string;
  lastName: string;
  position: string;
  teamId: number | null;
  jerseyNumber: string | null;
}) {
  const [row] = await db
    .insert(players)
    .values(player)
    .onConflictDoUpdate({
      target: players.externalId,
      set: { ...player, updatedAt: new Date() },
    })
    .returning();
  return row!;
}

export async function getPlayersByTeamId(teamId: number) {
  return db.select().from(players).where(eq(players.teamId, teamId));
}

// ─── Games ───

export async function upsertGame(game: {
  externalId: number;
  homeTeamId: number;
  awayTeamId: number;
  gameDate: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
}) {
  const [row] = await db
    .insert(games)
    .values(game)
    .onConflictDoUpdate({
      target: games.externalId,
      set: { ...game, updatedAt: new Date() },
    })
    .returning();
  return row!;
}

export async function getGamesByDate(date: string) {
  return db.select().from(games).where(eq(games.gameDate, date));
}

export async function getUngradedGames() {
  return db
    .select()
    .from(games)
    .where(
      and(eq(games.status, "scheduled"))
    );
}

export async function getGameByExternalId(externalId: number) {
  const [row] = await db
    .select()
    .from(games)
    .where(eq(games.externalId, externalId));
  return row;
}

// ─── Player Stats ───

export async function upsertPlayerStats(stat: {
  playerId: number;
  gameId: number;
  minutes: string | null;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  turnovers: number;
  pf: number;
}) {
  const [row] = await db
    .insert(playerStats)
    .values(stat)
    .onConflictDoUpdate({
      target: [playerStats.playerId, playerStats.gameId],
      set: stat,
    })
    .returning();
  return row!;
}

export async function getPlayerRecentStats(
  playerId: number,
  limit = 5
) {
  return db
    .select()
    .from(playerStats)
    .where(eq(playerStats.playerId, playerId))
    .orderBy(sql`${playerStats.fetchedAt} DESC`)
    .limit(limit);
}

// ─── Season Averages ───

export async function upsertSeasonAverage(avg: {
  playerId: number;
  season: number;
  gamesPlayed: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgPct: number;
  fg3Pct: number;
  ftPct: number;
  turnovers: number;
}) {
  const [row] = await db
    .insert(seasonAverages)
    .values(avg)
    .onConflictDoUpdate({
      target: [seasonAverages.playerId, seasonAverages.season],
      set: { ...avg, updatedAt: new Date() },
    })
    .returning();
  return row!;
}

export async function getSeasonAverage(playerId: number, season: number) {
  const [row] = await db
    .select()
    .from(seasonAverages)
    .where(
      and(
        eq(seasonAverages.playerId, playerId),
        eq(seasonAverages.season, season)
      )
    );
  return row;
}

// ─── Team Stats ───

export async function upsertTeamStats(stat: {
  teamId: number;
  season: number;
  wins: number;
  losses: number;
  ppg: number;
  oppPpg: number;
  pace: number | null;
  offRating: number | null;
  defRating: number | null;
}) {
  const [row] = await db
    .insert(teamStats)
    .values(stat)
    .onConflictDoUpdate({
      target: [teamStats.teamId, teamStats.season],
      set: { ...stat, updatedAt: new Date() },
    })
    .returning();
  return row!;
}

export async function getTeamStats(teamId: number, season: number) {
  const [row] = await db
    .select()
    .from(teamStats)
    .where(
      and(eq(teamStats.teamId, teamId), eq(teamStats.season, season))
    );
  return row;
}

// ─── Predictions ───

export async function insertPrediction(pred: {
  gameId: number;
  type: string;
  modelUsed: string;
  prediction: unknown;
  confidence: number;
  reasoning: string | null;
}) {
  const [row] = await db.insert(predictions).values(pred).returning();
  return row!;
}

export async function gradePrediction(
  id: number,
  result: "correct" | "incorrect" | "push"
) {
  await db
    .update(predictions)
    .set({ result, gradedAt: new Date() })
    .where(eq(predictions.id, id));
}

export async function getUngradedPredictions(gameId: number) {
  return db
    .select()
    .from(predictions)
    .where(
      and(eq(predictions.gameId, gameId), isNull(predictions.result))
    );
}

export async function getPredictionsByDate(date: string) {
  return db
    .select({
      id: predictions.id,
      type: predictions.type,
      prediction: predictions.prediction,
      confidence: predictions.confidence,
      reasoning: predictions.reasoning,
      result: predictions.result,
      gameDate: games.gameDate,
      homeTeamId: games.homeTeamId,
      awayTeamId: games.awayTeamId,
    })
    .from(predictions)
    .innerJoin(games, eq(predictions.gameId, games.id))
    .where(eq(games.gameDate, date));
}

// ─── Subscribers ───

export async function upsertSubscriber(sub: {
  platformId: string;
  displayName: string | null;
}) {
  const [row] = await db
    .insert(subscribers)
    .values({ ...sub, isActive: true })
    .onConflictDoUpdate({
      target: subscribers.platformId,
      set: { isActive: true, displayName: sub.displayName, updatedAt: new Date() },
    })
    .returning();
  return row!;
}

export async function deactivateSubscriber(platformId: string) {
  await db
    .update(subscribers)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(subscribers.platformId, platformId));
}

export async function getActiveSubscribers() {
  return db
    .select()
    .from(subscribers)
    .where(eq(subscribers.isActive, true));
}

export async function updateSubscriberPreferences(
  platformId: string,
  preferences: Record<string, unknown>
) {
  await db
    .update(subscribers)
    .set({ preferences, updatedAt: new Date() })
    .where(eq(subscribers.platformId, platformId));
}

// ─── Accuracy Snapshots ───

export async function upsertAccuracySnapshot(snap: {
  periodType: string;
  periodStart: string;
  predictionType: string;
  totalPicks: number;
  correctPicks: number;
  accuracyPct: number | null;
}) {
  const [row] = await db
    .insert(accuracySnapshots)
    .values(snap)
    .onConflictDoUpdate({
      target: [
        accuracySnapshots.periodType,
        accuracySnapshots.periodStart,
        accuracySnapshots.predictionType,
      ],
      set: { ...snap, computedAt: new Date() },
    })
    .returning();
  return row!;
}
