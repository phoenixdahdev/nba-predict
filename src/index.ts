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
  .use(accuracyRoutes)
  .listen(process.env.PORT ?? 3000);

console.log(
  `🏀 NBA Predict running at http://${app.server?.hostname}:${app.server?.port}`
);

export default app;
