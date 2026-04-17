import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock } from "@anthropic-ai/sdk/resources/messages";
import { generateImageForPost } from "@/lib/generate-post-image";
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

  let body: { topic?: string; tone?: string; audience?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topic = body.topic?.trim() || "professional growth and leadership";
  const tone = body.tone?.trim() || "insightful and conversational";
  const audience = body.audience?.trim() || "LinkedIn professionals";

  const anthropic = new Anthropic({ apiKey: key });
  const model =
    process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6";
  const prompt = `Write a LinkedIn post (under 2200 characters) about: ${topic}.
Tone: ${tone}.
Target audience: ${audience}.
Use short paragraphs, optional bullet points, and end with 3-5 relevant hashtags. No placeholder text.`;

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find(
      (b: ContentBlock): b is Extract<ContentBlock, { type: "text" }> =>
        b.type === "text",
    );
    const text = textBlock?.text ?? "";
    const post = text.trim();

    const themeForImage =
      topic.length > 120 ? `${topic.slice(0, 120)}…` : topic;
    const { images, imagePrompt } = await generateImageForPost(
      anthropic,
      model,
      post,
      themeForImage,
    );

    return NextResponse.json({
      post,
      images,
      imageUrl: images[0] ?? undefined,
      imagePrompt: imagePrompt ?? undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
