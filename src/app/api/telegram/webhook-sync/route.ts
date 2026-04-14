import { NextResponse } from "next/server";
import { getNgrokHttpsPublicUrl } from "@/lib/ngrok-tunnels";
import { getTelegramBot } from "@/lib/telegram-bot";

export const runtime = "nodejs";

/**
 * Fetches the current HTTPS URL from ngrok's local API (127.0.0.1:4040) and
 * registers Telegram webhook as {url}/api/approval/webhook.
 * Requires ngrok and this Next server on the same machine (typical local dev).
 */
export async function POST(req: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SETUP_SECRET?.trim();
  const provided = req.headers.get("x-telegram-setup-secret")?.trim();
  if (!expected || provided !== expected) {
    return NextResponse.json(
      { error: "Invalid or missing x-telegram-setup-secret" },
      { status: 401 },
    );
  }

  const base = await getNgrokHttpsPublicUrl();
  if (!base) {
    return NextResponse.json(
      {
        error:
          "Could not read ngrok URL from http://127.0.0.1:4040/api/tunnels. Start ngrok (e.g. ngrok http 3000) on this machine.",
      },
      { status: 503 },
    );
  }

  const webhookUrl = `${base}/api/approval/webhook`;

  try {
    const bot = getTelegramBot();
    await bot.setWebHook(webhookUrl, {
      allowed_updates: ["callback_query", "message"],
    });
    return NextResponse.json({
      ok: true,
      webhookUrl,
      ngrokPublicUrl: base,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "setWebHook failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
