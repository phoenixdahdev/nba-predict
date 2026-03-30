import { getActiveSubscribers } from "../db/queries";

// Lazy import to avoid circular dependency
async function getBotInstance() {
  const { getBot } = await import("../bot");
  return getBot();
}

/**
 * Normalize a chat ID for openDM — ensure it has exactly one "telegram:" prefix.
 */
function normalizeTelegramId(id: string): string {
  const raw = id.replace(/^telegram:/i, "");
  return `telegram:${raw}`;
}

/**
 * Send a message to all active subscribers.
 */
export async function notifyAllSubscribers(message: string): Promise<void> {
  const [subs, bot] = await Promise.all([getActiveSubscribers(), getBotInstance()]);

  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      const dmId = normalizeTelegramId(sub.platformId);
      const thread = await bot.openDM(dmId);
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
  const dmId = normalizeTelegramId(chatId);
  console.log(`[notifications] Sending to ${dmId}`);
  const thread = await bot.openDM(dmId);
  await thread.post(message);
}
