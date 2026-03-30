import { Elysia } from "elysia";
import { telegramRoutes } from "./routes/telegram";
import { predictionRoutes } from "./routes/predictions";
import { accuracyRoutes } from "./routes/accuracy";

const app = new Elysia()
  .get("/health", () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "nba-predict",
  }))
  .use(telegramRoutes)
  .use(predictionRoutes)
  .use(accuracyRoutes);

export default app;
