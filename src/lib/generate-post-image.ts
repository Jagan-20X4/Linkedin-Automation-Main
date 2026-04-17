import Anthropic from "@anthropic-ai/sdk";
import type { ContentBlock } from "@anthropic-ai/sdk/resources/messages";
import { GoogleGenAI, PersonGeneration, SafetyFilterLevel } from "@google/genai";

export type GeneratedPostImage = {
  images: string[];
  imagePrompt: string | null;
};

/**
 * Claude writes a photorealistic image prompt; Google Imagen 4 returns a base64 data URL.
 * Used by Compose (single post) and Compose V2 (multi-post plan).
 */
export async function generateImageForPost(
  anthropic: InstanceType<typeof Anthropic>,
  claudeModel: string,
  postContent: string,
  theme: string,
): Promise<GeneratedPostImage> {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiKey || geminiKey === "your_key_here") {
    console.log("GEMINI_API_KEY not set — skipping image generation");
    return { images: [], imagePrompt: null };
  }

  const genai = new GoogleGenAI({ apiKey: geminiKey });

  try {
    console.log(`Writing image prompt for "${theme}"…`);
    const promptMsg = await anthropic.messages.create({
      model: claudeModel,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Read this LinkedIn post and write a realistic photographic image prompt for it.

POST THEME: ${theme}
POST CONTENT: ${postContent.substring(0, 300)}

Requirements for the image prompt:
- Photorealistic, modern professional photography style
- Captures the CORE MESSAGE of the post visually
- Real people in a real professional environment (office, meeting room, cafe)
- Cinematic lighting, high quality DSLR look
- NO text, NO words, NO letters anywhere in the image
- Warm, human, authentic feel
- LinkedIn professional context
- Maximum 80 words

Write ONLY the image prompt, nothing else.`,
        },
      ],
    });

    const textBlock = promptMsg.content.find(
      (b: ContentBlock): b is Extract<ContentBlock, { type: "text" }> =>
        b.type === "text",
    );
    const imagePrompt = textBlock?.text?.trim() ?? "";
    if (!imagePrompt) {
      console.log(`No image prompt from Claude for "${theme}" — skipping Imagen`);
      return { images: [], imagePrompt: null };
    }

    console.log(`Generating image for "${theme}" via Imagen 4…`);
    const response = await genai.models.generateImages({
      model: "imagen-4.0-generate-001",
      prompt: imagePrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: "1:1",
        safetyFilterLevel: SafetyFilterLevel.BLOCK_LOW_AND_ABOVE,
        personGeneration: PersonGeneration.ALLOW_ADULT,
      },
    });

    const first = response.generatedImages?.[0];
    const bytes = first?.image?.imageBytes;
    if (!bytes) {
      const reason = first?.raiFilteredReason;
      console.error(
        `Imagen returned no image for "${theme}"${reason ? `: ${reason}` : ""}`,
      );
      return { images: [], imagePrompt };
    }

    const mime =
      first.image?.mimeType?.split(";")[0]?.trim() || "image/png";
    const dataUrl = `data:${mime};base64,${bytes}`;
    console.log(`Image generated for "${theme}"`);
    return { images: [dataUrl], imagePrompt };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Image generation failed for "${theme}":`, msg);
    return { images: [], imagePrompt: null };
  }
}
