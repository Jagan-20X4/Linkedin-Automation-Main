import {
  getApprovalById,
  syncPendingPostImagesFromApproval,
  updateApproval,
} from "@/lib/scheduled-approvals-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; imageIndex: string }> },
) {
  const { id, imageIndex: imageIndexRaw } = await ctx.params;
  const imageIndex = parseInt(imageIndexRaw, 10);
  if (!id?.trim() || Number.isNaN(imageIndex)) {
    return NextResponse.json({ error: "Invalid parameters." }, { status: 400 });
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

  const current = [
    ...(approval.images?.length
      ? approval.images
      : approval.imageUrl?.trim()
        ? [approval.imageUrl.trim()]
        : []),
  ];
  if (imageIndex < 0 || imageIndex >= current.length) {
    return NextResponse.json({ error: "Image index out of range." }, { status: 404 });
  }
  current.splice(imageIndex, 1);

  await updateApproval(id, { images: current });
  await syncPendingPostImagesFromApproval(
    approval.chatId,
    approval.postIndex,
    current,
  );

  return NextResponse.json({ success: true, images: current });
}
