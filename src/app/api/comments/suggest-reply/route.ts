import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock } from "@anthropic-ai/sdk/resources/messages";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key || key === "your_key_here") {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 },
    );
  }

  let body: {
    postContent?: string;
    commentText?: string;
    authorName?: string;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const commentText = body.commentText?.trim();
  if (!commentText) {
    return NextResponse.json(
      { error: "Comment text required." },
      { status: 400 },
    );
  }

  const postContent = body.postContent?.trim() ?? "";
  const authorName = body.authorName?.trim() || "someone";

  const anthropic = new Anthropic({ apiKey: key });
  const model =
    process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6";

  const prompt = `You are a LinkedIn thought leader replying to a comment on your post.

YOUR POST:
${postContent || "(no post body provided)"}

COMMENT by ${authorName}:
"${commentText}"

Write a professional, warm, and engaging reply to this comment.
- Keep it concise (2-4 sentences max)
- Be genuine and add value
- Do not use generic phrases like "Great point!"
- Sound human and natural
- Do NOT include any preamble, just the reply text itself`;

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = message.content.find(
      (b: ContentBlock): b is Extract<ContentBlock, { type: "text" }> =>
        b.type === "text",
    );
    const suggestion = textBlock?.text?.trim() ?? "";
    return NextResponse.json({ success: true, suggestion });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to generate reply.";
    return NextResponse.json(
      { error: "Failed to generate reply.", details: msg },
      { status: 500 },
    );
  }
}
