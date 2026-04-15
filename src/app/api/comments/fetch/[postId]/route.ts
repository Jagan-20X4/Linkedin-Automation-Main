import axios from "axios";
import { linkedinHeaders } from "@/lib/linkedin";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CommentRow = {
  id: string;
  author: string;
  text: string;
  createdAt: string | null;
};

function mapElement(c: Record<string, unknown>): CommentRow | null {
  const id = typeof c.id === "string" ? c.id : "";
  if (!id) return null;
  const message = c.message as Record<string, unknown> | undefined;
  const text =
    typeof message?.text === "string"
      ? message.text
      : typeof (message as { attributes?: { text?: string } })?.attributes?.text ===
          "string"
        ? (message as { attributes: { text: string } }).attributes.text
        : "";
  const actor = c["actor~"] as Record<string, unknown> | undefined;
  const first =
    typeof actor?.localizedFirstName === "string"
      ? actor.localizedFirstName
      : "";
  const last =
    typeof actor?.localizedLastName === "string"
      ? actor.localizedLastName
      : "";
  const author = `${first} ${last}`.trim() || "LinkedIn member";
  const created = c.created as { time?: number } | undefined;
  const createdAt =
    typeof created?.time === "number"
      ? new Date(created.time).toISOString()
      : null;
  return { id, author, text, createdAt };
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ postId: string }> },
) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
  if (!token || token === "your_key_here") {
    return NextResponse.json(
      { error: "LINKEDIN_ACCESS_TOKEN is not configured" },
      { status: 500 },
    );
  }

  const { postId: rawParam } = await ctx.params;
  const postId = decodeURIComponent(rawParam ?? "").trim();
  if (!postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  const encoded = encodeURIComponent(postId);
  const projection = encodeURIComponent(
    "(elements*(id,message,actor~(localizedFirstName,localizedLastName),created))",
  );
  const urlWithProj = `https://api.linkedin.com/v2/socialActions/${encoded}/comments?projection=${projection}`;
  const urlSimple = `https://api.linkedin.com/v2/socialActions/${encoded}/comments?count=50`;

  function parseComments(data: { elements?: unknown[] }): CommentRow[] {
    const elements = Array.isArray(data.elements) ? data.elements : [];
    const comments: CommentRow[] = [];
    for (const el of elements) {
      if (typeof el !== "object" || el === null) continue;
      const row = mapElement(el as Record<string, unknown>);
      if (row) comments.push(row);
    }
    return comments;
  }

  try {
    let data: { elements?: unknown[] };
    try {
      const res = await axios.get<{ elements?: unknown[] }>(urlWithProj, {
        headers: linkedinHeaders(token),
      });
      data = res.data;
    } catch (first) {
      if (
        axios.isAxiosError(first) &&
        first.response &&
        first.response.status >= 400
      ) {
        const res = await axios.get<{ elements?: unknown[] }>(urlSimple, {
          headers: linkedinHeaders(token),
        });
        data = res.data;
      } else {
        throw first;
      }
    }
    const comments = parseComments(data);
    return NextResponse.json({ success: true, comments });
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      return NextResponse.json(
        {
          error: "Failed to fetch comments.",
          details: err.response.data ?? err.message,
        },
        { status: err.response.status >= 400 ? err.response.status : 500 },
      );
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch comments.", details: msg },
      { status: 500 },
    );
  }
}
