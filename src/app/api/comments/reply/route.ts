import axios from "axios";
import { getPersonUrn, linkedinHeaders } from "@/lib/linkedin";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
  if (!token || token === "your_key_here") {
    return NextResponse.json(
      { error: "LINKEDIN_ACCESS_TOKEN is not configured" },
      { status: 500 },
    );
  }

  let body: {
    postId?: string;
    commentId?: string;
    replyText?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const replyText = body.replyText?.trim();
  const postId = body.postId?.trim();
  const commentId = body.commentId?.trim();
  if (!replyText) {
    return NextResponse.json(
      { error: "Reply text required." },
      { status: 400 },
    );
  }
  if (!postId || !commentId) {
    return NextResponse.json(
      { error: "postId and commentId are required." },
      { status: 400 },
    );
  }

  let actor: string;
  try {
    actor = await getPersonUrn(token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to resolve author URN";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const encodedPost = encodeURIComponent(postId);
  const url = `https://api.linkedin.com/v2/socialActions/${encodedPost}/comments`;

  const payload: Record<string, unknown> = {
    actor,
    message: { text: replyText },
    parentComment: commentId,
  };

  try {
    await axios.post(url, payload, { headers: linkedinHeaders(token) });
    return NextResponse.json({
      success: true,
      message: "Reply posted successfully!",
    });
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      return NextResponse.json(
        {
          error: "Failed to post reply.",
          details: err.response.data ?? err.message,
        },
        { status: err.response.status >= 400 ? err.response.status : 500 },
      );
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to post reply.", details: msg },
      { status: 500 },
    );
  }
}
