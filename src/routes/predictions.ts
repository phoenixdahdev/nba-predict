import { Elysia } from "elysia";
import { db } from "../db";
import { predictions, games, teams } from "../db/schema";
import { eq, desc } from "drizzle-orm";

export const predictionRoutes = new Elysia({ prefix: "/api/predictions" })
  .get("/", async ({ query }) => {
    const dateFilter = query.date as string | undefined;
    const rows = await db
      .select({
        id: predictions.id,
        type: predictions.type,
        prediction: predictions.prediction,
        confidence: predictions.confidence,
        reasoning: predictions.reasoning,
        result: predictions.result,
        createdAt: predictions.createdAt,
        gameDate: games.gameDate,
      })
      .from(predictions)
      .innerJoin(games, eq(predictions.gameId, games.id))
      .where(dateFilter ? eq(games.gameDate, dateFilter) : undefined)
      .orderBy(desc(predictions.createdAt))
      .limit(50);

    return { predictions: rows };
  })
  .get("/:gameId", async ({ params }) => {
    const gameId = parseInt(params.gameId);
    const rows = await db
      .select()
      .from(predictions)
      .where(eq(predictions.gameId, gameId))
      .orderBy(predictions.type);

    return { predictions: rows };
  });
