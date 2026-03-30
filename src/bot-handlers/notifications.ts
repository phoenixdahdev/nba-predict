import { getActiveSubscribers } from "../db/queries";

// Lazy import to avoid circular dependency (bot.ts → commands.ts → notifications.ts → bot.ts)
async function getBot() {
  const { bot } = await import("../bot");
  return bot;
}

/**
 * Send a message to all active subscribers.
 */
export async function notifyAllSubscribers(message: string): Promise<void> {
  const [subs, bot] = await Promise.all([getActiveSubscribers(), getBot()]);

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      const chatId = sub.platformId.replace("telegram:", "");
      const thread = await bot.openDM(`telegram:${chatId}`);
      await thread.post(message);
    })
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    console.error(`Failed to notify ${failed}/${subs.length} subscribers`);
  }
}

/**
 * Send a message to a specific chat ID.
 */
export async function notifyChat(
  chatId: string,
  message: string
): Promise<void> {
  const bot = await getBot();
  const thread = await bot.openDM(`telegram:${chatId}`);
  await thread.post(message);
}
