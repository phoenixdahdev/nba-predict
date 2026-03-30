import { Elysia } from "elysia";
import { db } from "../db";
import { accuracySnapshots, predictions } from "../db/schema";
import { eq, desc, sql, and, isNotNull } from "drizzle-orm";

export const accuracyRoutes = new Elysia({ prefix: "/api/accuracy" })
  .get("/", async () => {
    // Overall accuracy by prediction type
    const overall = await db
      .select({
        type: predictions.type,
        total: sql<number>`count(*)`.as("total"),
        correct: sql<number>`count(*) filter (where ${predictions.result} = 'correct')`.as("correct"),
        accuracy: sql<number>`round(count(*) filter (where ${predictions.result} = 'correct')::numeric / nullif(count(*), 0) * 100, 1)`.as("accuracy"),
      })
      .from(predictions)
      .where(isNotNull(predictions.result))
      .groupBy(predictions.type);

    return { accuracy: overall };
  })
  .get("/snapshots", async ({ query }) => {
    const period = (query.period as string) ?? "daily";
    const rows = await db
      .select()
      .from(accuracySnapshots)
      .where(eq(accuracySnapshots.periodType, period))
      .orderBy(desc(accuracySnapshots.periodStart))
      .limit(30);

    return { snapshots: rows };
  });
