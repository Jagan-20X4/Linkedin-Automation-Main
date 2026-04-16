import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock } from "@anthropic-ai/sdk/resources/messages";
import type { ComposeV2Chat, ComposeV2Post } from "@/lib/compose-v2-chats-store";
import {
  getChatById,
  readChats,
  saveChatWithPostsClient,
} from "@/lib/compose-v2-chats-store";
import { calculateScheduledDates } from "@/lib/compose-v2-schedule";
import { withTransaction } from "@/lib/db";
import type { ScheduledApprovalItem } from "@/lib/scheduled-approvals-store";
import { replacePendingApprovalsForChatClient } from "@/lib/scheduled-approvals-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key || key === "your_key_here") {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 },
    );
  }

  let body: {
    topic?: string;
    durationType?: string;
    durationValue?: number;
    chatId?: string | null;
  } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const topicFromBody = body.topic?.trim() ?? "";

  const durationType = body.durationType;
  if (durationType !== "weeks" && durationType !== "months") {
    return NextResponse.json(
      { error: "durationType must be weeks or months." },
      { status: 400 },
    );
  }

  const durationValue = Number(body.durationValue);
  const max = durationType === "weeks" ? 52 : 24;
  if (!Number.isFinite(durationValue) || durationValue < 1 || durationValue > max) {
    return NextResponse.json(
      { error: `durationValue must be 1–${max} for ${durationType}.` },
      { status: 400 },
    );
  }

  const unit = durationType === "weeks" ? "week" : "month";
  const unitPlural = durationType === "weeks" ? "weeks" : "months";
  const labelWord = durationType === "weeks" ? "Week" : "Month";

  const anthropic = new Anthropic({ apiKey: key });
  const model =
    process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-6";

  const chatsForTopic = await readChats();
  const existingIdForTopic =
    typeof body.chatId === "string" && body.chatId.trim()
      ? body.chatId.trim()
      : null;
  const existingChatForTopic = existingIdForTopic
    ? chatsForTopic.find((c) => c.id === existingIdForTopic)
    : undefined;

  /** New chats require a topic; existing chats keep the stored strategy (not the request body). */
  const topic =
    (existingChatForTopic &&
      (existingChatForTopic.topic?.trim() ||
        existingChatForTopic.title?.trim())) ||
    topicFromBody;
  if (!topic) {
    return NextResponse.json({ error: "Topic is required." }, { status: 400 });
  }

  const prompt = `You are a LinkedIn content strategist. Based on the topic/strategy below, generate a structured ${durationValue}-${unitPlural} LinkedIn post plan.

TOPIC / STRATEGY:
${topic}

Generate exactly ${durationValue} LinkedIn posts — one per ${unit}. For each ${unit}:
- Extract the most relevant theme from the strategy
- Write a full LinkedIn post (200–400 words), professional, engaging, non-salesy
- Use storytelling, insights, or thought leadership angle
- Include relevant emojis naturally
- End with a subtle call-to-reflection or question

Respond ONLY with a valid JSON array, no markdown, no preamble:
[
  {
    "index": 1,
    "label": "${labelWord} 1",
    "theme": "short theme title",
    "content": "full linkedin post text here"
  }
]`;

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find(
      (b: ContentBlock): b is Extract<ContentBlock, { type: "text" }> =>
        b.type === "text",
    );
    const raw = textBlock?.text?.trim() ?? "";
    const cleaned = stripJsonFences(raw);
    const generatedPosts = JSON.parse(cleaned) as unknown;
    if (!Array.isArray(generatedPosts) || generatedPosts.length === 0) {
      return NextResponse.json(
        { error: "Model did not return a valid posts array.", details: raw.slice(0, 400) },
        { status: 502 },
      );
    }

    const createdAt = new Date().toISOString();
    const scheduledDates = calculateScheduledDates(
      durationType,
      durationValue,
      createdAt,
    );

    type ParsedRow = { row: Record<string, unknown>; arrayIndex: number; index: number };

    const parsed: ParsedRow[] = (generatedPosts as unknown[]).map((row, arrayIndex) => {
      const p = row as Record<string, unknown>;
      const index =
        typeof p.index === "number" && Number.isFinite(p.index)
          ? Math.trunc(p.index)
          : arrayIndex + 1;
      return { row: p, arrayIndex, index };
    });

    parsed.sort((a, b) => {
      if (a.index !== b.index) return a.index - b.index;
      return a.arrayIndex - b.arrayIndex;
    });

    const posts: ComposeV2Post[] = parsed.map(({ row: p, arrayIndex, index }) => {
      const label = `${labelWord} ${index}`;
      const theme =
        typeof p.theme === "string" && p.theme.trim()
          ? p.theme.trim()
          : `Theme ${index}`;
      const content =
        typeof p.content === "string"
          ? p.content
          : typeof p.post === "string"
            ? p.post
            : "";
      const slot = Math.max(
        0,
        Math.min(scheduledDates.length - 1, Math.max(0, index - 1)),
      );
      const scheduledDate =
        scheduledDates[slot] ?? scheduledDates[scheduledDates.length - 1];
      return {
        index,
        label,
        theme,
        content,
        scheduledDate,
        status: "pending" as const,
      };
    });

    let chat: ComposeV2Chat;

    const existingId =
      typeof body.chatId === "string" && body.chatId.trim()
        ? body.chatId.trim()
        : null;

    if (existingId) {
      const prev = await getChatById(existingId);
      if (!prev) {
        return NextResponse.json({ error: "Chat not found." }, { status: 404 });
      }
      chat = {
        ...prev,
        durationType,
        durationValue,
        posts,
        updatedAt: createdAt,
      };
    } else {
      const title =
        topic.length > 40 ? `${topic.slice(0, 40)}…` : topic;
      chat = {
        id: crypto.randomUUID(),
        title,
        topic,
        durationType,
        durationValue,
        posts,
        createdAt,
      };
    }

    const approvalItems: ScheduledApprovalItem[] = posts.map((p) => ({
      id: crypto.randomUUID(),
      chatId: chat.id,
      chatTitle: chat.title,
      postIndex: p.index,
      label: p.label,
      theme: p.theme,
      content: p.content,
      scheduledDate: p.scheduledDate,
      status: "pending" as const,
      publishedAt: null,
      linkedinPostId: null,
    }));

    await withTransaction(async (c) => {
      await saveChatWithPostsClient(c, chat);
      await replacePendingApprovalsForChatClient(c, chat.id, approvalItems);
    });

    return NextResponse.json({ success: true, chat });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to generate.";
    return NextResponse.json({ error: "Failed to generate.", details: msg }, { status: 500 });
  }
}
