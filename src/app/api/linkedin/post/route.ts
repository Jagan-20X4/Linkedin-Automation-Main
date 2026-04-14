import { NextResponse } from "next/server";
import { publishLinkedInPost } from "@/lib/publish-linkedin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: { text?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const result = await publishLinkedInPost(text);
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.message,
        status: result.status,
        details: result.details,
        hint:
          result.status === 502
            ? "Ensure the token has openid/profile and w_member_social scopes."
            : undefined,
      },
      { status: result.status >= 400 && result.status < 600 ? result.status : 502 },
    );
  }

  return NextResponse.json(
    { ok: true, status: result.status, data: result.data },
    { status: 201 },
  );
}
