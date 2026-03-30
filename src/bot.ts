import { Chat } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createRedisState } from "@chat-adapter/state-redis";

export const bot = new Chat({
  userName: "nba-predict-bot",
  adapters: {
    telegram: createTelegramAdapter(),
  },
  state: createRedisState({
    url: process.env.REDIS_URL,
  }),
});

// Lazy-register commands to avoid circular imports
// (commands.ts and notifications.ts both reference bot)
import("./bot-handlers/commands").then(({ registerCommands }) => {
  registerCommands(bot);
});
