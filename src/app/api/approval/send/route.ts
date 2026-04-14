import { NextResponse } from "next/server";
import { createDraft } from "@/lib/approval-store";
import { getTelegramBot } from "@/lib/telegram-bot";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId || chatId === "your_key_here") {
    return NextResponse.json(
      { error: "TELEGRAM_CHAT_ID is not configured" },
      { status: 500 },
    );
  }

  let body: { text?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const draftId = createDraft(text);

  try {
    const bot = getTelegramBot();
    await bot.sendMessage(chatId, `LinkedIn draft pending approval:\n\n${text}`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "Approve", callback_data: `approve:${draftId}` },
            { text: "Reject", callback_data: `reject:${draftId}` },
          ],
        ],
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Telegram send failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  return NextResponse.json({ ok: true, draftId });
}
