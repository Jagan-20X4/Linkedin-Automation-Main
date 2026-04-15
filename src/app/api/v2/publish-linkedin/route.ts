import { appendPublishedPost } from "@/lib/published-posts-store";
import { getChatById, readChats, writeChats } from "@/lib/compose-v2-chats-store";
import { publishLinkedInPost } from "@/lib/publish-linkedin";
import { updateApprovalByChatPost } from "@/lib/scheduled-approvals-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: {
    content?: string;
    week?: number | null;
    theme?: string | null;
    chatId?: string;
    postIndex?: number | string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.content?.trim();
  if (!text) {
    return NextResponse.json({ error: "Content is required." }, { status: 400 });
  }

  const chatId = typeof body.chatId === "string" ? body.chatId.trim() : "";
  const postIndex =
    typeof body.postIndex === "number" && Number.isFinite(body.postIndex)
      ? body.postIndex
      : typeof body.postIndex === "string"
        ? parseInt(body.postIndex, 10)
        : NaN;

  const result = await publishLinkedInPost(text);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.message,
        details: result.details,
        hint:
          result.status === 502
            ? "Ensure the token has openid/profile and w_member_social scopes."
            : undefined,
      },
      {
        status:
          result.status >= 400 && result.status < 600 ? result.status : 502,
      },
    );
  }

  const data = result.data as { id?: string } | undefined;
  const postId =
    typeof data?.id === "string" ? data.id : JSON.stringify(result.data ?? {});

  const now = new Date().toISOString();

  if (chatId && !Number.isNaN(postIndex)) {
    const chats = readChats();
    const chat = chats.find((c) => c.id === chatId);
    if (chat) {
      const post = chat.posts.find((p) => p.index === postIndex);
      if (post) {
        post.status = "published";
        post.linkedinPostId = postId;
        post.publishedAt = now;
        writeChats(chats);
      }
    }
    updateApprovalByChatPost(chatId, postIndex, {
      status: "published",
      publishedAt: now,
      linkedinPostId: postId,
    });
  }

  let week: number | null =
    typeof body.week === "number" && Number.isFinite(body.week)
      ? body.week
      : null;
  let theme: string | null =
    typeof body.theme === "string" && body.theme.trim()
      ? body.theme.trim()
      : null;
  if (chatId && !Number.isNaN(postIndex)) {
    const chat = getChatById(chatId);
    const post = chat?.posts.find((p) => p.index === postIndex);
    if (post) {
      week = postIndex;
      theme = post.theme;
    }
  }

  try {
    appendPublishedPost({
      postId,
      content: text,
      week,
      theme,
    });
  } catch {
    /* ignore */
  }

  return NextResponse.json({ success: true, postId }, { status: 201 });
}
