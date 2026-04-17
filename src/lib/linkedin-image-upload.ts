import axios from "axios";
import { linkedinHeaders } from "@/lib/linkedin";

const ASSETS = "https://api.linkedin.com/v2/assets";

export function dataUrlToBuffer(dataUrl: string): { buffer: Buffer; mime: string } {
  const trimmed = dataUrl.trim();
  const m = /^data:([^;]+);base64,([\s\S]+)$/.exec(trimmed);
  if (!m) {
    throw new Error("Image must be a data: URL (base64).");
  }
  return {
    mime: (m[1] || "image/jpeg").split(";")[0]?.trim() || "image/jpeg",
    buffer: Buffer.from(m[2], "base64"),
  };
}

/**
 * Registers a feedshare image upload, PUTs bytes, returns digitalmedia asset URN for UGC.
 */
export async function uploadFeedshareImage(
  accessToken: string,
  ownerPersonUrn: string,
  imageDataUrl: string,
): Promise<string> {
  const { buffer } = dataUrlToBuffer(imageDataUrl);
  const { data } = await axios.post(
    `${ASSETS}?action=registerUpload`,
    {
      registerUploadRequest: {
        recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
        owner: ownerPersonUrn,
        serviceRelationships: [
          {
            relationshipType: "OWNER",
            identifier: "urn:li:userGeneratedContent",
          },
        ],
      },
    },
    { headers: linkedinHeaders(accessToken) },
  );

  const val = (data as { value?: Record<string, unknown> }).value ?? data;
  const uploadMechanism = (val as { uploadMechanism?: Record<string, unknown> })
    .uploadMechanism;
  const httpReq = uploadMechanism?.[
    "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
  ] as { uploadUrl?: string } | undefined;
  const uploadUrl = httpReq?.uploadUrl;
  const asset = (val as { asset?: string }).asset;
  if (!uploadUrl || !asset || typeof asset !== "string") {
    throw new Error(
      `LinkedIn registerUpload unexpected response: ${JSON.stringify(data).slice(0, 500)}`,
    );
  }

  await axios.put(uploadUrl, buffer, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/octet-stream",
    },
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  return asset;
}
