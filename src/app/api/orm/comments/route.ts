import axios from "axios";
import { NextResponse } from "next/server";
import { linkedinHeaders } from "@/lib/linkedin";

export const runtime = "nodejs";

/**
 * Fetches comments for a LinkedIn social URN (e.g. urn:li:activity:... or urn:li:ugcPost:...).
 * Pass ?urn=... (URL-encoded). Optional: &count=10
 */
export async function GET(req: Request) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  if (!token || token === "your_key_here") {
    return NextResponse.json(
      { error: "LINKEDIN_ACCESS_TOKEN is not configured" },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const urn = searchParams.get("urn")?.trim();
  if (!urn) {
    return NextResponse.json(
      { error: "Query parameter urn is required (URL-encoded LinkedIn URN)" },
      { status: 400 },
    );
  }

  const count = Math.min(
    Number(searchParams.get("count") ?? "10") || 10,
    100,
  );

  const encoded = encodeURIComponent(urn);
  const url = `https://api.linkedin.com/v2/socialActions/${encoded}/comments?count=${count}`;

  try {
    const { data, status } = await axios.get(url, {
      headers: linkedinHeaders(token),
    });
    return NextResponse.json({ elements: data.elements ?? data, status });
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      return NextResponse.json(
        {
          error: "LinkedIn API error",
          status: err.response.status,
          details: err.response.data,
        },
        { status: err.response.status },
      );
    }
    throw err;
  }
}
