import { Chat } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createRedisState } from "@chat-adapter/state-redis";
import { registerCommands } from "./bot-handlers/commands";

export const bot = new Chat({
  userName: "nba-predict-bot",
  adapters: {
    telegram: createTelegramAdapter(),
  },
  state: createRedisState({
    url: process.env.REDIS_URL,
  }),
});

registerCommands(bot);
