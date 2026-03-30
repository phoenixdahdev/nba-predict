import { bot } from "../bot";
import { getActiveSubscribers } from "../db/queries";

/**
 * Send a message to all active subscribers.
 */
export async function notifyAllSubscribers(message: string): Promise<void> {
  const subs = await getActiveSubscribers();

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
  const thread = await bot.openDM(`telegram:${chatId}`);
  await thread.post(message);
}
