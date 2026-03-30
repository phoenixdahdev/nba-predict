import { Elysia } from "elysia";
import { bot } from "../bot";

export const telegramRoutes = new Elysia({ prefix: "/telegram" }).post(
  "/webhook",
  async ({ request }) => {
    await bot.webhooks.telegram(request);
    return { ok: true };
  }
);
