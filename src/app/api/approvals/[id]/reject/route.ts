import { readChats, writeChats } from "@/lib/compose-v2-chats-store";
import { getApprovalById, updateApproval } from "@/lib/scheduled-approvals-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const approval = getApprovalById(id);
  if (!approval) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const now = new Date().toISOString();

  updateApproval(id, {
    status: "rejected",
    rejectedAt: now,
  });

  const chats = readChats();
  const chat = chats.find((c) => c.id === approval.chatId);
  if (chat) {
    const post = chat.posts.find((p) => p.index === approval.postIndex);
    if (post) {
      post.status = "rejected";
      writeChats(chats);
    }
  }

  return NextResponse.json({ success: true });
}
