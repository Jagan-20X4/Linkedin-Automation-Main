import { appendPublishedPost } from "@/lib/published-posts-store";
import { readChats, writeChats } from "@/lib/compose-v2-chats-store";
import { publishLinkedInPost } from "@/lib/publish-linkedin";
import {
  getApprovalById,
  updateApproval,
} from "@/lib/scheduled-approvals-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const approval = getApprovalById(id);
  if (!approval) {
    return NextResponse.json({ error: "Approval not found." }, { status: 404 });
  }
  if (approval.status === "published") {
    return NextResponse.json({ error: "Already published." }, { status: 400 });
  }

  const result = await publishLinkedInPost(approval.content);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.message,
        details: result.details,
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

  updateApproval(id, {
    status: "published",
    publishedAt: now,
    linkedinPostId: postId,
  });

  const chats = readChats();
  const chat = chats.find((c) => c.id === approval.chatId);
  if (chat) {
    const post = chat.posts.find((p) => p.index === approval.postIndex);
    if (post) {
      post.status = "published";
      post.linkedinPostId = postId;
      post.publishedAt = now;
      writeChats(chats);
    }
  }

  try {
    appendPublishedPost({
      postId,
      content: approval.content,
      week: approval.postIndex,
      theme: approval.theme,
    });
  } catch {
    /* ignore */
  }

  return NextResponse.json({ success: true, postId });
}
