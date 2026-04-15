import { readChats } from "@/lib/compose-v2-chats-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const chats = readChats();
  const summary = [...chats]
    .reverse()
    .map((c) => ({
      id: c.id,
      title: c.title,
      durationType: c.durationType,
      durationValue: c.durationValue,
      postCount: c.posts?.length ?? 0,
      createdAt: c.createdAt,
    }));
  return NextResponse.json({ success: true, chats: summary });
}
