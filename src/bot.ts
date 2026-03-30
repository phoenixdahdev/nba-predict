import { Chat } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createRedisState } from "@chat-adapter/state-redis";

let _bot: Chat | undefined;

export function getBot(): Chat {
  if (!_bot) {
    _bot = new Chat({
      userName: "nba-predict-bot",
      adapters: {
        telegram: createTelegramAdapter(),
      },
      state: createRedisState({
        url: process.env.REDIS_URL,
      }),
    });

    // Register commands lazily
    import("./bot-handlers/commands").then(({ registerCommands }) => {
      registerCommands(_bot!);
    });
  }
  return _bot;
}

// For backwards compat with notifications.ts etc
export const bot = {
  get webhooks() {
    return getBot().webhooks;
  },
  openDM: (...args: Parameters<Chat["openDM"]>) => getBot().openDM(...args),
};
