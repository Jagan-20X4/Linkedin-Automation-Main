import { readChatSummaries } from "@/lib/compose-v2-chats-store";
import { disambiguateLabels } from "@/lib/chat-display-label";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const chats = await readChatSummaries();
  const summary = [...chats].reverse().map((c) => ({
    id: c.id,
    title: c.title,
    durationType: c.durationType,
    durationValue: c.durationValue,
    postCount: c.postCount,
    createdAt: c.createdAt,
  }));
  const displayById = disambiguateLabels(
    summary.map((s) => s.id),
    (id) => summary.find((s) => s.id === id)?.title ?? "",
  );
  const withDisplay = summary.map((s) => ({
    ...s,
    displayTitle: displayById.get(s.id) ?? s.title,
  }));
  return NextResponse.json({ success: true, chats: withDisplay });
}
