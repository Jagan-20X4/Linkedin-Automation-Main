import { getChatById, updatePostInChat } from "@/lib/compose-v2-chats-store";
import { syncPendingApprovalImagesFromPost } from "@/lib/scheduled-approvals-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_IMAGES = 9;
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; postIndex: string }> },
) {
  const { id: chatId, postIndex: postIndexRaw } = await ctx.params;
  const postIndex = parseInt(postIndexRaw, 10);
  if (!chatId?.trim() || Number.isNaN(postIndex)) {
    return NextResponse.json({ error: "Invalid chat or post." }, { status: 400 });
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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart form data." },
      { status: 400 },
    );
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file field." }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 4MB or smaller." }, { status: 400 });
  }
  const mime =
    (typeof (file as File).type === "string" ? (file as File).type : "") ||
    "image/jpeg";
  const baseMime = mime.split(";")[0]?.trim() || "image/jpeg";
  if (!baseMime.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are allowed." }, { status: 400 });
  }
  const dataUrl = `data:${baseMime};base64,${buf.toString("base64")}`;

  const current = [
    ...(post.images?.length
      ? post.images
      : post.imageUrl?.trim()
        ? [post.imageUrl.trim()]
        : []),
  ];
  if (current.length >= MAX_IMAGES) {
    return NextResponse.json(
      { error: `At most ${MAX_IMAGES} images per post.` },
      { status: 400 },
    );
  }
  current.push(dataUrl);

  await updatePostInChat(chatId.trim(), postIndex, { images: current });
  await syncPendingApprovalImagesFromPost(chatId.trim(), postIndex, current);

  return NextResponse.json({ success: true, images: current });
}
