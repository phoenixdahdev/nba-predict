import {
  pgTable,
  serial,
  integer,
  text,
  date,
  real,
  boolean,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";

// --- Teams ---
export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  externalId: integer("external_id").unique().notNull(),
  abbreviation: text("abbreviation").notNull(),
  city: text("city").notNull(),
  name: text("name").notNull(),
  conference: text("conference").notNull(),
  division: text("division").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Players ---
export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  externalId: integer("external_id").unique().notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  position: text("position").notNull(),
  teamId: integer("team_id").references(() => teams.id),
  jerseyNumber: text("jersey_number"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Games ---
export const games = pgTable("games", {
  id: serial("id").primaryKey(),
  externalId: integer("external_id").unique().notNull(),
  homeTeamId: integer("home_team_id")
    .references(() => teams.id)
    .notNull(),
  awayTeamId: integer("away_team_id")
    .references(() => teams.id)
    .notNull(),
  gameDate: date("game_date").notNull(),
  status: text("status").notNull().default("scheduled"),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Player Stats (per-game) ---
export const playerStats = pgTable(
  "player_stats",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .references(() => players.id)
      .notNull(),
    gameId: integer("game_id")
      .references(() => games.id)
      .notNull(),
    minutes: text("minutes"),
    pts: integer("pts").notNull().default(0),
    reb: integer("reb").notNull().default(0),
    ast: integer("ast").notNull().default(0),
    stl: integer("stl").notNull().default(0),
    blk: integer("blk").notNull().default(0),
    fgm: integer("fgm").notNull().default(0),
    fga: integer("fga").notNull().default(0),
    fg3m: integer("fg3m").notNull().default(0),
    fg3a: integer("fg3a").notNull().default(0),
    ftm: integer("ftm").notNull().default(0),
    fta: integer("fta").notNull().default(0),
    turnovers: integer("turnovers").notNull().default(0),
    pf: integer("pf").notNull().default(0),
    fetchedAt: timestamp("fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("player_game_unique").on(t.playerId, t.gameId)]
);

// --- Season Averages (refreshed daily) ---
export const seasonAverages = pgTable(
  "season_averages",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .references(() => players.id)
      .notNull(),
    season: integer("season").notNull(),
    gamesPlayed: integer("games_played").notNull().default(0),
    pts: real("pts").notNull().default(0),
    reb: real("reb").notNull().default(0),
    ast: real("ast").notNull().default(0),
    stl: real("stl").notNull().default(0),
    blk: real("blk").notNull().default(0),
    fgPct: real("fg_pct").notNull().default(0),
    fg3Pct: real("fg3_pct").notNull().default(0),
    ftPct: real("ft_pct").notNull().default(0),
    turnovers: real("turnovers").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("player_season_unique").on(t.playerId, t.season)]
);

// --- Team Stats (refreshed daily) ---
export const teamStats = pgTable(
  "team_stats",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .references(() => teams.id)
      .notNull(),
    season: integer("season").notNull(),
    wins: integer("wins").notNull().default(0),
    losses: integer("losses").notNull().default(0),
    ppg: real("ppg").notNull().default(0),
    oppPpg: real("opp_ppg").notNull().default(0),
    pace: real("pace"),
    offRating: real("off_rating"),
    defRating: real("def_rating"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("team_season_unique").on(t.teamId, t.season)]
);

// --- Predictions ---
export const predictions = pgTable("predictions", {
  id: serial("id").primaryKey(),
  gameId: integer("game_id")
    .references(() => games.id)
    .notNull(),
  type: text("type").notNull(), // total, spread, moneyline, player_prop
  modelUsed: text("model_used").notNull(),
  prediction: jsonb("prediction").notNull(),
  confidence: real("confidence").notNull(),
  reasoning: text("reasoning"),
  result: text("result"), // correct, incorrect, push, null
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  gradedAt: timestamp("graded_at", { withTimezone: true }),
});

// --- Subscribers ---
export const subscribers = pgTable("subscribers", {
  id: serial("id").primaryKey(),
  platformId: text("platform_id").unique().notNull(),
  platformType: text("platform_type").notNull().default("telegram"),
  displayName: text("display_name"),
  isActive: boolean("is_active").notNull().default(true),
  preferences: jsonb("preferences").default({}),
  subscribedAt: timestamp("subscribed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// --- Accuracy Snapshots ---
export const accuracySnapshots = pgTable(
  "accuracy_snapshots",
  {
    id: serial("id").primaryKey(),
    periodType: text("period_type").notNull(), // daily, weekly, monthly
    periodStart: date("period_start").notNull(),
    predictionType: text("prediction_type").notNull(),
    totalPicks: integer("total_picks").notNull().default(0),
    correctPicks: integer("correct_picks").notNull().default(0),
    accuracyPct: real("accuracy_pct"),
    computedAt: timestamp("computed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("accuracy_period_unique").on(
      t.periodType,
      t.periodStart,
      t.predictionType
    ),
  ]
);
