import { NextResponse } from "next/server";
import { getTelegramBot } from "@/lib/telegram-bot";

export const runtime = "nodejs";

/**
 * Registers Telegram webhook (HTTPS). Call from curl or this UI with secret.
 * Header: x-telegram-setup-secret must match TELEGRAM_WEBHOOK_SETUP_SECRET in .env.local
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

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url || !url.startsWith("https://")) {
    return NextResponse.json(
      { error: "url must be a full https:// URL to /api/approval/webhook" },
      { status: 400 },
    );
  }

  try {
    const bot = getTelegramBot();
    await bot.setWebHook(url, {
      allowed_updates: ["callback_query", "message"],
    });
    return NextResponse.json({ ok: true, webhookUrl: url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "setWebHook failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
