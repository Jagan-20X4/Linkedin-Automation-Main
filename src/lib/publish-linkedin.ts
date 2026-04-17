import axios from "axios";
import { getPersonUrn, linkedinHeaders } from "@/lib/linkedin";
import { uploadFeedshareImage } from "@/lib/linkedin-image-upload";

const UGC = "https://api.linkedin.com/v2/ugcPosts";

const MAX_IMAGES = 9;

export type PublishLinkedInResult =
  | { ok: true; status: number; data: unknown }
  | {
      ok: false;
      status: number;
      message: string;
      details?: unknown;
    };

function sanitizeDataImageUrls(urls: unknown): string[] {
  if (!Array.isArray(urls)) return [];
  const out: string[] = [];
  for (const u of urls) {
    if (typeof u !== "string") continue;
    const t = u.trim();
    if (t.startsWith("data:image/")) out.push(t);
    if (out.length >= MAX_IMAGES) break;
  }
  return out;
}

export async function publishLinkedInPost(
  text: string,
  imageDataUrls?: string[] | null,
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

  const images = sanitizeDataImageUrls(imageDataUrls);

  let shareInner: Record<string, unknown>;
  if (images.length === 0) {
    shareInner = {
      shareCommentary: { text: trimmed },
      shareMediaCategory: "NONE",
    };
  } else {
    const media: { status: string; media: string }[] = [];
    for (const dataUrl of images) {
      try {
        const urn = await uploadFeedshareImage(token, author, dataUrl);
        media.push({ status: "READY", media: urn });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          ok: false,
          status: 502,
          message: `LinkedIn image upload failed: ${msg}`,
        };
      }
    }
    shareInner = {
      shareCommentary: { text: trimmed },
      shareMediaCategory: "IMAGE",
      media,
    };
  }

  const payload = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": shareInner,
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
