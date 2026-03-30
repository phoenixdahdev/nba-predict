import { Chat } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createRedisState } from "@chat-adapter/state-redis";

let _bot: Chat | undefined;
let _ready: Promise<void> | undefined;

export async function getBot(): Promise<Chat> {
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

    // Register commands and wait for it to complete
    _ready = import("./bot-handlers/commands").then(({ registerCommands }) => {
      registerCommands(_bot!);
    });
  }

  // Ensure commands are registered before returning
  await _ready;
  return _bot;
}
