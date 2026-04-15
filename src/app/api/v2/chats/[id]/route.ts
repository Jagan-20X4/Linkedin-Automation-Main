import { deleteChatById, getChatById } from "@/lib/compose-v2-chats-store";
import { removeApprovalsForChat } from "@/lib/scheduled-approvals-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const chat = getChatById(id);
  if (!chat) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }
  return NextResponse.json({ success: true, chat });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!deleteChatById(id)) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }
  removeApprovalsForChat(id);
  return NextResponse.json({ success: true });
}
