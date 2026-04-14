import axios from "axios";
import { getPersonUrn, linkedinHeaders } from "@/lib/linkedin";

const UGC = "https://api.linkedin.com/v2/ugcPosts";

export type PublishLinkedInResult =
  | { ok: true; status: number; data: unknown }
  | {
      ok: false;
      status: number;
      message: string;
      details?: unknown;
    };

export async function publishLinkedInPost(
  text: string,
): Promise<PublishLinkedInResult> {
  const token = process.env.LINKEDIN_ACCESS_TOKEN?.trim();
  if (!token || token === "your_key_here") {
    return {
      ok: false,
      status: 500,
      message: "LINKEDIN_ACCESS_TOKEN is not configured",
    };
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, status: 400, message: "Post text is empty" };
  }

  let author: string;
  try {
    author = await getPersonUrn(token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to resolve author URN";
    return { ok: false, status: 502, message: msg };
  }

  const payload = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: trimmed },
        shareMediaCategory: "NONE",
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  try {
    const { data, status } = await axios.post(UGC, payload, {
      headers: linkedinHeaders(token),
    });
    return { ok: true, status, data };
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      return {
        ok: false,
        status: err.response.status,
        message: "LinkedIn API error",
        details: err.response.data,
      };
    }
    throw err;
  }
}
