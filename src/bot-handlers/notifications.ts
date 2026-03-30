import { getActiveSubscribers } from "../db/queries";

// Lazy import to avoid circular dependency
async function getBotInstance() {
  const { getBot } = await import("../bot");
  return getBot();
}

/**
 * Send a message to all active subscribers.
 */
export async function notifyAllSubscribers(message: string): Promise<void> {
  const [subs, bot] = await Promise.all([getActiveSubscribers(), getBotInstance()]);

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
  const bot = await getBotInstance();
  const thread = await bot.openDM(`telegram:${chatId}`);
  await thread.post(message);
}
