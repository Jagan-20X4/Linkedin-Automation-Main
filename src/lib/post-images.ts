/** Normalize image list from DB JSONB + legacy single image_url column. */
export function normalizeImagesFromDb(
  imagesJson: unknown,
  legacyImageUrl: string | null,
): string[] {
  const out: string[] = [];
  if (imagesJson != null) {
    const raw = Array.isArray(imagesJson)
      ? imagesJson
      : typeof imagesJson === "string"
        ? (() => {
            try {
              const p = JSON.parse(imagesJson) as unknown;
              return Array.isArray(p) ? p : [];
            } catch {
              return [];
            }
          })()
        : [];
    for (const item of raw) {
      if (typeof item === "string" && item.trim()) out.push(item.trim());
    }
  }
  if (out.length === 0 && legacyImageUrl?.trim()) {
    out.push(legacyImageUrl.trim());
  }
  return out;
}

export function imagesToJsonbValue(images: string[]): string {
  return JSON.stringify(images ?? []);
}

export function primaryImageUrl(images: string[]): string | null {
  const first = images.find((u) => typeof u === "string" && u.trim());
  return first?.trim() ?? null;
}
