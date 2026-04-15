import { readPublishedPosts } from "@/lib/published-posts-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const posts = readPublishedPosts();
  return NextResponse.json({ success: true, posts: [...posts].reverse() });
}
