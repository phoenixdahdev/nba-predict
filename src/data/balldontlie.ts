import { RateLimiter } from "./rate-limiter";

const BASE_URL = "https://api.balldontlie.io/v1";
const limiter = new RateLimiter(5, 60_000); // 5 req/min

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    next_cursor?: number;
    per_page: number;
  };
}

async function apiFetch<T>(
  endpoint: string,
  params?: Record<string, string | string[]>
): Promise<T> {
  await limiter.acquire();

  const url = new URL(`${BASE_URL}${endpoint}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        for (const v of value) {
          url.searchParams.append(key, v);
        }
      } else {
        url.searchParams.set(key, value);
      }
    }
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: process.env.BALLDONTLIE_API_KEY!,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`balldontlie API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// --- Types matching balldontlie API responses ---

export interface BDLTeam {
  id: number;
  abbreviation: string;
  city: string;
  name: string;
  conference: string;
  division: string;
  full_name: string;
}

export interface BDLPlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  jersey_number: string;
  team: BDLTeam;
}

export interface BDLGame {
  id: number;
  date: string;
  status: string;
  home_team: BDLTeam;
  visitor_team: BDLTeam;
  home_team_score: number;
  visitor_team_score: number;
  season: number;
}

export interface BDLStats {
  id: number;
  min: string;
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
  oreb: number;
  dreb: number;
  turnover: number;
  pf: number;
  player: BDLPlayer;
  team: BDLTeam;
  game: { id: number; date: string; status: string };
}

export interface BDLSeasonAverage {
  games_played: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fg_pct: number;
  fg3_pct: number;
  ft_pct: number;
  turnover: number;
  player_id: number;
  season: number;
}

// --- API Methods ---

export const balldontlie = {
  async getGames(date: string): Promise<BDLGame[]> {
    const res = await apiFetch<PaginatedResponse<BDLGame>>("/games", {
      "dates[]": [date],
      per_page: "100",
    });
    return res.data;
  },

  async getGameById(gameId: number): Promise<BDLGame> {
    return apiFetch<BDLGame>(`/games/${gameId}`);
  },

  async getTeams(): Promise<BDLTeam[]> {
    const res = await apiFetch<PaginatedResponse<BDLTeam>>("/teams", {
      per_page: "100",
    });
    return res.data;
  },

  async getActivePlayers(
    teamIds?: number[],
    cursor?: number
  ): Promise<PaginatedResponse<BDLPlayer>> {
    const params: Record<string, string | string[]> = { per_page: "100" };
    if (teamIds) {
      params["team_ids[]"] = teamIds.map(String);
    }
    if (cursor) {
      params.cursor = String(cursor);
    }
    return apiFetch<PaginatedResponse<BDLPlayer>>("/players/active", params);
  },

  async getPlayerStats(
    playerIds: number[],
    season: number
  ): Promise<BDLStats[]> {
    const res = await apiFetch<PaginatedResponse<BDLStats>>("/stats", {
      "player_ids[]": playerIds.map(String),
      "seasons[]": [String(season)],
      per_page: "100",
    });
    return res.data;
  },

  async getSeasonAverages(
    playerIds: number[],
    season: number
  ): Promise<BDLSeasonAverage[]> {
    const params: Record<string, string | string[]> = {
      "player_ids[]": playerIds.map(String),
      season: String(season),
    };
    const res = await apiFetch<PaginatedResponse<BDLSeasonAverage>>(
      "/season_averages",
      params
    );
    return res.data;
  },

  async getRecentGames(
    teamId: number,
    season: number,
    limit = 10
  ): Promise<BDLGame[]> {
    const res = await apiFetch<PaginatedResponse<BDLGame>>("/games", {
      "team_ids[]": [String(teamId)],
      "seasons[]": [String(season)],
      per_page: String(limit),
    });
    return res.data;
  },
};
