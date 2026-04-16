import type { PoolClient } from "pg";
import { getPool, withTransaction } from "@/lib/db";

export type ComposeV2Post = {
  index: number;
  label: string;
  theme: string;
  content: string;
  scheduledDate: string;
  status: "pending" | "published" | "rejected";
  publishedAt?: string | null;
  linkedinPostId?: string | null;
};

export type ComposeV2Chat = {
  id: string;
  title: string;
  topic: string;
  durationType: "weeks" | "months";
  durationValue: number;
  posts: ComposeV2Post[];
  createdAt: string;
  updatedAt?: string;
};

function mapPostRow(r: {
  post_index: number;
  label: string;
  theme: string;
  content: string;
  scheduled_date: Date;
  status: string;
  published_at: Date | null;
  linkedin_post_id: string | null;
}): ComposeV2Post {
  return {
    index: r.post_index,
    label: r.label,
    theme: r.theme,
    content: r.content,
    scheduledDate:
      r.scheduled_date instanceof Date
        ? r.scheduled_date.toISOString()
        : String(r.scheduled_date),
    status: r.status as ComposeV2Post["status"],
    publishedAt: r.published_at
      ? r.published_at instanceof Date
        ? r.published_at.toISOString()
        : String(r.published_at)
      : null,
    linkedinPostId: r.linkedin_post_id,
  };
}

function mapChatRow(
  c: {
    id: string;
    title: string;
    topic: string;
    duration_type: string;
    duration_value: number;
    created_at: Date;
    updated_at: Date | null;
  },
  posts: ComposeV2Post[],
): ComposeV2Chat {
  return {
    id: c.id,
    title: c.title,
    topic: c.topic,
    durationType: c.duration_type as ComposeV2Chat["durationType"],
    durationValue: c.duration_value,
    posts,
    createdAt:
      c.created_at instanceof Date ? c.created_at.toISOString() : String(c.created_at),
    updatedAt: c.updated_at
      ? c.updated_at instanceof Date
        ? c.updated_at.toISOString()
        : String(c.updated_at)
      : undefined,
  };
}

async function loadPostsForChatIds(
  client: { query: PoolClient["query"] },
  chatIds: string[],
): Promise<Map<string, ComposeV2Post[]>> {
  const map = new Map<string, ComposeV2Post[]>();
  if (chatIds.length === 0) return map;
  const res = await client.query<{
    chat_id: string;
    post_index: number;
    label: string;
    theme: string;
    content: string;
    scheduled_date: Date;
    status: string;
    published_at: Date | null;
    linkedin_post_id: string | null;
  }>(
    `SELECT chat_id, post_index, label, theme, content, scheduled_date, status, published_at, linkedin_post_id
     FROM compose_v2_posts WHERE chat_id = ANY($1::uuid[]) ORDER BY chat_id, post_index`,
    [chatIds],
  );
  for (const row of res.rows) {
    const list = map.get(row.chat_id) ?? [];
    list.push(mapPostRow(row));
    map.set(row.chat_id, list);
  }
  return map;
}

export async function readChats(): Promise<ComposeV2Chat[]> {
  const pool = getPool();
  const chatsRes = await pool.query<{
    id: string;
    title: string;
    topic: string;
    duration_type: string;
    duration_value: number;
    created_at: Date;
    updated_at: Date | null;
  }>(
    `SELECT id, title, topic, duration_type, duration_value, created_at, updated_at
     FROM compose_v2_chats ORDER BY created_at ASC`,
  );
  const ids = chatsRes.rows.map((r) => r.id);
  const postsByChat = await loadPostsForChatIds(pool, ids);
  return chatsRes.rows.map((c) =>
    mapChatRow(c, postsByChat.get(c.id) ?? []),
  );
}

export async function getChatById(id: string): Promise<ComposeV2Chat | undefined> {
  const pool = getPool();
  const chatsRes = await pool.query<{
    id: string;
    title: string;
    topic: string;
    duration_type: string;
    duration_value: number;
    created_at: Date;
    updated_at: Date | null;
  }>(
    `SELECT id, title, topic, duration_type, duration_value, created_at, updated_at
     FROM compose_v2_chats WHERE id = $1::uuid`,
    [id],
  );
  const row = chatsRes.rows[0];
  if (!row) return undefined;
  const postsByChat = await loadPostsForChatIds(pool, [id]);
  return mapChatRow(row, postsByChat.get(id) ?? []);
}

/** Replace chat row and all posts (used after generate / regenerate). */
export async function saveChatWithPostsClient(
  client: PoolClient,
  chat: ComposeV2Chat,
): Promise<void> {
  await client.query(
    `INSERT INTO compose_v2_chats (id, title, topic, duration_type, duration_value, created_at, updated_at)
     VALUES ($1::uuid, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       topic = EXCLUDED.topic,
       duration_type = EXCLUDED.duration_type,
       duration_value = EXCLUDED.duration_value,
       updated_at = EXCLUDED.updated_at,
       created_at = compose_v2_chats.created_at`,
    [
      chat.id,
      chat.title,
      chat.topic,
      chat.durationType,
      chat.durationValue,
      chat.createdAt,
      chat.updatedAt ?? null,
    ],
  );
  await client.query(`DELETE FROM compose_v2_posts WHERE chat_id = $1::uuid`, [chat.id]);
  for (const p of chat.posts) {
    await client.query(
      `INSERT INTO compose_v2_posts (chat_id, post_index, label, theme, content, scheduled_date, status, published_at, linkedin_post_id)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::timestamptz, $7, $8::timestamptz, $9)`,
      [
        chat.id,
        p.index,
        p.label,
        p.theme,
        p.content,
        p.scheduledDate,
        p.status,
        p.publishedAt ?? null,
        p.linkedinPostId ?? null,
      ],
    );
  }
}

export async function saveChatWithPosts(chat: ComposeV2Chat): Promise<void> {
  await withTransaction((c) => saveChatWithPostsClient(c, chat));
}

export async function deleteChatById(id: string): Promise<boolean> {
  const pool = getPool();
  const res = await pool.query(`DELETE FROM compose_v2_chats WHERE id = $1::uuid`, [id]);
  return res.rowCount !== null && res.rowCount > 0;
}

export async function upsertChat(chat: ComposeV2Chat): Promise<void> {
  await saveChatWithPosts(chat);
}

export async function updatePostInChat(
  chatId: string,
  postIndex: number,
  patch: Partial<ComposeV2Post>,
): Promise<boolean> {
  const pool = getPool();
  const sets: string[] = [];
  const values: unknown[] = [chatId, postIndex];
  let n = 3;
  if (patch.label !== undefined) {
    sets.push(`label = $${n++}`);
    values.push(patch.label);
  }
  if (patch.theme !== undefined) {
    sets.push(`theme = $${n++}`);
    values.push(patch.theme);
  }
  if (patch.content !== undefined) {
    sets.push(`content = $${n++}`);
    values.push(patch.content);
  }
  if (patch.scheduledDate !== undefined) {
    sets.push(`scheduled_date = $${n++}::timestamptz`);
    values.push(patch.scheduledDate);
  }
  if (patch.status !== undefined) {
    sets.push(`status = $${n++}`);
    values.push(patch.status);
  }
  if (patch.publishedAt !== undefined) {
    sets.push(`published_at = $${n++}`);
    values.push(patch.publishedAt);
  }
  if (patch.linkedinPostId !== undefined) {
    sets.push(`linkedin_post_id = $${n++}`);
    values.push(patch.linkedinPostId);
  }
  if (sets.length === 0) return false;
  const res = await pool.query(
    `UPDATE compose_v2_posts SET ${sets.join(", ")} WHERE chat_id = $1::uuid AND post_index = $2`,
    values,
  );
  return res.rowCount !== null && res.rowCount > 0;
}
