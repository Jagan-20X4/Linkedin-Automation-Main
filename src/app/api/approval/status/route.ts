import { NextResponse } from "next/server";
import { getDraft } from "@/lib/approval-store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const draftId = new URL(req.url).searchParams.get("draftId")?.trim();
  if (!draftId) {
    return NextResponse.json(
      { error: "Query parameter draftId is required" },
      { status: 400 },
    );
  }

  const draft = getDraft(draftId);
  if (!draft) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    draftId,
    status: draft.status,
    linkedinPosted: draft.linkedinPosted === true,
    linkedinError: draft.linkedinError,
  });
}
