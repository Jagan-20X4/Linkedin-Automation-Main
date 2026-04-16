import { updatePostInChat } from "@/lib/compose-v2-chats-store";
import { getApprovalById, updateApproval } from "@/lib/scheduled-approvals-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const raw =
    typeof body === "object" && body !== null && "content" in body
      ? String((body as { content: unknown }).content)
      : "";
  const trimmed = raw.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Content cannot be empty." }, { status: 400 });
  }

  const approval = await getApprovalById(id);
  if (!approval) {
    return NextResponse.json({ error: "Approval not found." }, { status: 404 });
  }
  if (approval.status !== "pending") {
    return NextResponse.json(
      { error: "Only pending approvals can be edited." },
      { status: 400 },
    );
  }

  await updateApproval(id, { content: trimmed });
  await updatePostInChat(approval.chatId, approval.postIndex, { content: trimmed });

  return NextResponse.json({ success: true });
}
