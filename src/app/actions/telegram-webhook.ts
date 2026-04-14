"use server";

import { getNgrokHttpsPublicUrl } from "@/lib/ngrok-tunnels";
import { getTelegramBot } from "@/lib/telegram-bot";

const ALLOWED_UPDATES = ["callback_query", "message"] as const;

async function setWebhookUrl(url: string): Promise<void> {
  const bot = getTelegramBot();
  await bot.setWebHook(url, {
    allowed_updates: [...ALLOWED_UPDATES],
  });
}

export type WebhookActionResult =
  | { ok: true; webhookUrl: string; ngrokPublicUrl?: string }
  | { ok: false; error: string };

/**
 * Reads ngrok HTTPS URL from the local agent API and registers Telegram webhook.
 * Runs only on the server; uses TELEGRAM_BOT_TOKEN from env (not the setup secret).
 */
export async function syncTelegramWebhookFromNgrokAction(): Promise<WebhookActionResult> {
  try {
    const base = await getNgrokHttpsPublicUrl();
    if (!base) {
      return {
        ok: false,
        error:
          "Could not read ngrok at http://127.0.0.1:4040/api/tunnels. Start ngrok (e.g. ngrok http 3000) on this machine.",
      };
    }
    const webhookUrl = `${base}/api/approval/webhook`;
    await setWebhookUrl(webhookUrl);
    return { ok: true, webhookUrl, ngrokPublicUrl: base };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "setWebHook failed (check TELEGRAM_BOT_TOKEN)";
    return { ok: false, error: msg };
  }
}

/**
 * Registers Telegram webhook to an explicit https URL (manual paste).
 * Runs only on the server; uses TELEGRAM_BOT_TOKEN from env.
 */
export async function registerTelegramWebhookAction(
  url: string,
): Promise<WebhookActionResult> {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed.startsWith("https://")) {
    return { ok: false, error: "URL must start with https://" };
  }
  if (!trimmed.endsWith("/api/approval/webhook")) {
    return {
      ok: false,
      error: "URL must end with /api/approval/webhook",
    };
  }
  try {
    await setWebhookUrl(trimmed);
    return { ok: true, webhookUrl: trimmed };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "setWebHook failed (check TELEGRAM_BOT_TOKEN)";
    return { ok: false, error: msg };
  }
}
