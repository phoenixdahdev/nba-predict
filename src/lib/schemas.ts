import { z } from "zod";

// --- Prediction Output Schemas (used with AI SDK Output.object()) ---

export const moneylinePrediction = z.object({
  gameExternalId: z.number().describe("balldontlie game ID"),
  homeTeam: z.string().describe("Home team abbreviation"),
  awayTeam: z.string().describe("Away team abbreviation"),
  pick: z.string().describe("Team abbreviation predicted to win"),
  confidence: z.number().min(0).max(1).describe("Confidence 0-1"),
  reasoning: z.string().describe("Brief reasoning for the pick"),
});

export const totalPrediction = z.object({
  gameExternalId: z.number().describe("balldontlie game ID"),
  homeTeam: z.string(),
  awayTeam: z.string(),
  projectedTotal: z.number().describe("Projected combined score"),
  pick: z.enum(["over", "under"]).describe("Over or under prediction"),
  line: z.number().describe("The over/under line to beat"),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export const spreadPrediction = z.object({
  gameExternalId: z.number().describe("balldontlie game ID"),
  homeTeam: z.string(),
  awayTeam: z.string(),
  favorite: z.string().describe("Team abbreviation of the favorite"),
  spread: z.number().describe("Point spread (negative for favorite)"),
  pick: z.string().describe("Team abbreviation predicted to cover"),
  projectedMargin: z.number().describe("Projected victory margin"),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

export const playerPropPrediction = z.object({
  gameExternalId: z.number().describe("balldontlie game ID"),
  playerExternalId: z.number().describe("balldontlie player ID"),
  playerName: z.string(),
  team: z.string().describe("Player's team abbreviation"),
  stat: z
    .enum(["points", "assists", "rebounds", "steals", "blocks", "threes"])
    .describe("The stat category"),
  line: z.number().describe("The prop line"),
  pick: z.enum(["over", "under"]),
  projectedValue: z.number().describe("Projected stat value"),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

// --- Player Special Predictions (double-double, triple-double) ---

export const playerSpecialPrediction = z.object({
  gameExternalId: z.number().describe("balldontlie game ID"),
  playerExternalId: z.number().describe("balldontlie player ID"),
  playerName: z.string(),
  team: z.string().describe("Player's team abbreviation"),
  type: z
    .enum(["double_double", "triple_double"])
    .describe("Type of special stat achievement"),
  probability: z
    .number()
    .min(0)
    .max(1)
    .describe("Probability of achieving this (0-1)"),
  projectedStats: z.object({
    pts: z.number().describe("Projected points"),
    ast: z.number().describe("Projected assists"),
    reb: z.number().describe("Projected rebounds"),
    stl: z.number().describe("Projected steals"),
    blk: z.number().describe("Projected blocks"),
  }),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

// --- Batch prediction schemas (what the AI returns for multiple games) ---

export const batchQuickPredictions = z.object({
  moneyline: z.array(moneylinePrediction),
  totals: z.array(totalPrediction),
});

export const batchDeepPredictions = z.object({
  spreads: z.array(spreadPrediction),
  playerProps: z.array(playerPropPrediction),
});

export const batchPlayerPredictions = z.object({
  props: z
    .array(playerPropPrediction)
    .describe(
      "Individual stat predictions (pts, ast, reb, stl, blk, 3pm) — only include high-confidence picks"
    ),
  specials: z
    .array(playerSpecialPrediction)
    .describe(
      "Double-double and triple-double predictions for players likely to achieve them"
    ),
});

// --- Types ---
export type MoneylinePrediction = z.infer<typeof moneylinePrediction>;
export type TotalPrediction = z.infer<typeof totalPrediction>;
export type SpreadPrediction = z.infer<typeof spreadPrediction>;
export type PlayerPropPrediction = z.infer<typeof playerPropPrediction>;
export type PlayerSpecialPrediction = z.infer<typeof playerSpecialPrediction>;
export type BatchQuickPredictions = z.infer<typeof batchQuickPredictions>;
export type BatchDeepPredictions = z.infer<typeof batchDeepPredictions>;
export type BatchPlayerPredictions = z.infer<typeof batchPlayerPredictions>;
