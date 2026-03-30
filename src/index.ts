import { Elysia } from "elysia";
import { appendFileSync } from "fs";

const LOG_FILE = "./dev.log";

function log(msg: string, data?: unknown) {
  const line = `[${new Date().toISOString()}] ${msg}${data ? " " + JSON.stringify(data, null, 2) : ""}\n`;
  process.stdout.write(line);
  try { appendFileSync(LOG_FILE, line); } catch {}
}

const app = new Elysia()
  .onRequest(({ request }: { request: Request }) => {
    log(`→ ${request.method} ${new URL(request.url).pathname}`);
  })
  .onAfterHandle(({ request }: { request: Request }) => {
    log(`← ${request.method} ${new URL(request.url).pathname}`);
  })
  .onError(({ request, error }) => {
    log(`✗ ${request.method} ${new URL(request.url).pathname} ERROR`, {
      message: String(error),
    });
  })
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "nba-predict",
  }))
  .post("/telegram/webhook", async ({ request }) => {
    const cloned = request.clone();
    const body = await cloned.json().catch(() => null);
    log("TELEGRAM WEBHOOK BODY", body);

    try {
      const { getBot } = await import("./bot");
      const bot = await getBot();
      const result = await bot.webhooks.telegram!(request);
      log("TELEGRAM WEBHOOK RESULT", { ok: true });
      return { ok: true };
    } catch (err: any) {
      log("TELEGRAM WEBHOOK ERROR", { message: err.message, stack: err.stack });
      return { ok: false, error: err.message };
    }
  })
  .get("/api/predictions", async ({ query }) => {
    const { db } = await import("./db");
    const { predictions, games } = await import("./db/schema");
    const { eq, desc } = await import("drizzle-orm");

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
  .get("/api/predictions/:gameId", async ({ params }) => {
    const { db } = await import("./db");
    const { predictions } = await import("./db/schema");
    const { eq } = await import("drizzle-orm");

    const gameId = parseInt(params.gameId);
    const rows = await db
      .select()
      .from(predictions)
      .where(eq(predictions.gameId, gameId))
      .orderBy(predictions.type);

    return { predictions: rows };
  })
  .get("/api/accuracy", async () => {
    const { db } = await import("./db");
    const { predictions } = await import("./db/schema");
    const { isNotNull, sql } = await import("drizzle-orm");

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
  });

export default app;
