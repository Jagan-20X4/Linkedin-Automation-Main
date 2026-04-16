import { updatePostInChat } from "@/lib/compose-v2-chats-store";
import { getApprovalById, updateApproval } from "@/lib/scheduled-approvals-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const approval = await getApprovalById(id);
  if (!approval) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const now = new Date().toISOString();

  await updateApproval(id, {
    status: "rejected",
    rejectedAt: now,
  });

  await updatePostInChat(approval.chatId, approval.postIndex, {
    status: "rejected",
  });

  return NextResponse.json({ success: true });
}
