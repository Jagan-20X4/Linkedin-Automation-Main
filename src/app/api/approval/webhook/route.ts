import { NextResponse } from "next/server";
import {
  getDraft,
  setDraftLinkedInResult,
  setDraftStatus,
} from "@/lib/approval-store";
import { publishLinkedInPost } from "@/lib/publish-linkedin";
import { getTelegramBot } from "@/lib/telegram-bot";

export const runtime = "nodejs";

type TelegramUpdate = {
  callback_query?: {
    id: string;
    data?: string;
    message?: { chat: { id: number }; message_id: number };
  };
};

/** Opt-in: set LINKEDIN_POST_ON_APPROVE=true to post to LinkedIn from Telegram on approve. */
function shouldPostToLinkedInOnApprove(): boolean {
  return process.env.LINKEDIN_POST_ON_APPROVE === "true";
}

export async function POST(req: Request) {
  let update: TelegramUpdate;
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const q = update.callback_query;
  if (!q?.data) {
    return NextResponse.json({ ok: true, handled: false });
  }

  const data = q.data;
  const [action, draftId] = data.split(":");
  if (!draftId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ ok: true, handled: false });
  }

  try {
    const bot = getTelegramBot();
    const draft = getDraft(draftId);

    if (!draft) {
      await bot.answerCallbackQuery(q.id, {
        text: "Draft not found or expired",
      });
      return NextResponse.json({ ok: true, handled: true });
    }

    const status = action === "approve" ? "approved" : "rejected";
    setDraftStatus(draftId, status);

    await bot.answerCallbackQuery(q.id, {
      text: status === "approved" ? "Approved" : "Rejected",
    });

    const msg = q.message;
    if (msg) {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        {
          chat_id: msg.chat.id,
          message_id: msg.message_id,
        },
      );
      const chatId = msg.chat.id;
      const statusLine = status === "approved" ? "✅ Approved." : "❌ Rejected.";
      await bot.sendMessage(chatId, statusLine);

      if (action === "approve" && shouldPostToLinkedInOnApprove()) {
        const li = await publishLinkedInPost(draft.text);
        if (li.ok) {
          setDraftLinkedInResult(draftId, { posted: true });
          await bot.sendMessage(
            chatId,
            `LinkedIn: published successfully (draft ${draftId}).`,
          );
        } else {
          const errMsg =
            typeof li.details === "string"
              ? li.details
              : JSON.stringify(li.details ?? li.message).slice(0, 500);
          setDraftLinkedInResult(draftId, {
            posted: false,
            error: li.message,
          });
          await bot.sendMessage(
            chatId,
            `LinkedIn publish failed: ${li.message}. ${errMsg}`,
          );
        }
      } else if (action === "approve") {
        await bot.sendMessage(
          chatId,
          "Publish from the app: open Compose and tap Publish to LinkedIn now.",
        );
      }
    } else if (action === "approve" && shouldPostToLinkedInOnApprove()) {
      const li = await publishLinkedInPost(draft.text);
      if (li.ok) {
        setDraftLinkedInResult(draftId, { posted: true });
      } else {
        setDraftLinkedInResult(draftId, {
          posted: false,
          error: li.message,
        });
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Webhook processing failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, handled: true });
}
