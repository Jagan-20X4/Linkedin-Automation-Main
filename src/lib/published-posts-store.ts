import { getPool } from "@/lib/db";

export type PublishedPostRecord = {
  id: string;
  postId: string;
  content: string;
  week: number | null;
  theme: string | null;
  publishedAt: string;
};

export async function readPublishedPosts(): Promise<PublishedPostRecord[]> {
  const pool = getPool();
  const res = await pool.query<{
    id: string;
    linkedin_post_id: string;
    content: string;
    week: number | null;
    theme: string | null;
    published_at: Date;
  }>(
    `SELECT id, linkedin_post_id, content, week, theme, published_at FROM published_posts ORDER BY published_at ASC`,
  );
  return res.rows.map((r) => ({
    id: r.id,
    postId: r.linkedin_post_id,
    content: r.content,
    week: r.week,
    theme: r.theme,
    publishedAt:
      r.published_at instanceof Date
        ? r.published_at.toISOString()
        : String(r.published_at),
  }));
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function appendPublishedPost(
  entry: Omit<PublishedPostRecord, "id" | "publishedAt"> & {
    id?: string;
    publishedAt?: string;
  },
): Promise<PublishedPostRecord> {
  const pool = getPool();
  const publishedAt = entry.publishedAt ?? new Date().toISOString();
  const id =
    entry.id && UUID_RE.test(entry.id) ? entry.id : crypto.randomUUID();
  await pool.query(
    `INSERT INTO published_posts (id, linkedin_post_id, content, week, theme, published_at)
     VALUES ($1::uuid, $2, $3, $4, $5, $6::timestamptz)`,
    [
      id,
      entry.postId,
      entry.content,
      entry.week ?? null,
      entry.theme ?? null,
      publishedAt,
    ],
  );
  return {
    id,
    postId: entry.postId,
    content: entry.content,
    week: entry.week ?? null,
    theme: entry.theme ?? null,
    publishedAt,
  };
}
