import fs from "node:fs";
import path from "node:path";

export type PublishedPostRecord = {
  id: string;
  postId: string;
  content: string;
  week: number | null;
  theme: string | null;
  publishedAt: string;
};

function dataFilePath(): string {
  return path.join(process.cwd(), "data", "published-posts.json");
}

export function readPublishedPosts(): PublishedPostRecord[] {
  const p = dataFilePath();
  try {
    if (!fs.existsSync(p)) return [];
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((row): row is PublishedPostRecord => {
      if (typeof row !== "object" || row === null) return false;
      const r = row as Record<string, unknown>;
      return typeof r.postId === "string" && r.postId.length > 0;
    }) as PublishedPostRecord[];
  } catch {
    return [];
  }
}

export function appendPublishedPost(
  entry: Omit<PublishedPostRecord, "id" | "publishedAt"> & {
    id?: string;
    publishedAt?: string;
  },
): PublishedPostRecord {
  const dir = path.dirname(dataFilePath());
  fs.mkdirSync(dir, { recursive: true });
  const posts = readPublishedPosts();
  const row: PublishedPostRecord = {
    id: entry.id ?? `${Date.now()}`,
    postId: entry.postId,
    content: entry.content,
    week: entry.week ?? null,
    theme: entry.theme ?? null,
    publishedAt: entry.publishedAt ?? new Date().toISOString(),
  };
  posts.push(row);
  fs.writeFileSync(dataFilePath(), JSON.stringify(posts, null, 2), "utf8");
  return row;
}
