import {
  getApprovalById,
  syncPendingPostImagesFromApproval,
  updateApproval,
} from "@/lib/scheduled-approvals-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_IMAGES = 9;
const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
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
    ...(approval.images?.length
      ? approval.images
      : approval.imageUrl?.trim()
        ? [approval.imageUrl.trim()]
        : []),
  ];
  if (current.length >= MAX_IMAGES) {
    return NextResponse.json(
      { error: `At most ${MAX_IMAGES} images per post.` },
      { status: 400 },
    );
  }
  current.push(dataUrl);

  await updateApproval(id, { images: current });
  await syncPendingPostImagesFromApproval(
    approval.chatId,
    approval.postIndex,
    current,
  );

  return NextResponse.json({ success: true, images: current });
}
