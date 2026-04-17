import { getChatById, updatePostInChat } from "@/lib/compose-v2-chats-store";
import { syncPendingApprovalImagesFromPost } from "@/lib/scheduled-approvals-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; postIndex: string; imageIndex: string }> },
) {
  const { id: chatId, postIndex: postIndexRaw, imageIndex: imageIndexRaw } =
    await ctx.params;
  const postIndex = parseInt(postIndexRaw, 10);
  const imageIndex = parseInt(imageIndexRaw, 10);
  if (!chatId?.trim() || Number.isNaN(postIndex) || Number.isNaN(imageIndex)) {
    return NextResponse.json({ error: "Invalid parameters." }, { status: 400 });
  }

  const chat = await getChatById(chatId.trim());
  if (!chat) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }
  const post = chat.posts.find((p) => p.index === postIndex);
  if (!post) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }
  if (post.status !== "pending") {
    return NextResponse.json(
      { error: "Images can only be edited on pending posts." },
      { status: 400 },
    );
  }

  const current = [
    ...(post.images?.length
      ? post.images
      : post.imageUrl?.trim()
        ? [post.imageUrl.trim()]
        : []),
  ];
  if (imageIndex < 0 || imageIndex >= current.length) {
    return NextResponse.json({ error: "Image index out of range." }, { status: 404 });
  }
  current.splice(imageIndex, 1);

  await updatePostInChat(chatId.trim(), postIndex, { images: current });
  await syncPendingApprovalImagesFromPost(chatId.trim(), postIndex, current);

  return NextResponse.json({ success: true, images: current });
}
