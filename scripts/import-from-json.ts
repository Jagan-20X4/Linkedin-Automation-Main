/**
 * One-time import from legacy data/*.json into PostgreSQL.
 * Requires schema.sql applied and PG_* in .env (same as the app).
 *
 * Run: npx tsx scripts/import-from-json.ts
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { PoolClient } from "pg";
import { getPool, withTransaction } from "../src/lib/db";

type JsonChat = {
  id: string;
  title: string;
  topic: string;
  durationType: string;
  durationValue: number;
  posts: Array<{
    index: number;
    label: string;
    theme: string;
    content: string;
    scheduledDate: string;
    status: string;
    publishedAt?: string | null;
    linkedinPostId?: string | null;
    images?: string[] | null;
    imageUrl?: string | null;
    imagePrompt?: string | null;
  }>;
  createdAt: string;
  updatedAt?: string;
};

type JsonApproval = {
  id: string;
  chatId: string;
  chatTitle: string;
  postIndex: number;
  label: string;
  theme: string;
  content: string;
  scheduledDate: string;
  status: string;
  publishedAt: string | null;
  linkedinPostId: string | null;
  rejectedAt?: string | null;
  images?: string[] | null;
  imageUrl?: string | null;
  imagePrompt?: string | null;
};

type JsonPublished = {
  id?: string;
  postId: string;
  content: string;
  week?: number | null;
  theme?: string | null;
  publishedAt: string;
};

function readJson<T>(file: string): T | null {
  const p = path.join(process.cwd(), "data", file);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

async function importChats(client: PoolClient, chats: JsonChat[]) {
  for (const c of chats) {
    await client.query(
      `INSERT INTO compose_v2_chats (id, title, topic, duration_type, duration_value, created_at, updated_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz)
       ON CONFLICT (id) DO NOTHING`,
      [
        c.id,
        c.title,
        c.topic,
        c.durationType,
        c.durationValue,
        c.createdAt,
        c.updatedAt ?? null,
      ],
    );
    for (const p of c.posts ?? []) {
      const imgs =
        Array.isArray(p.images) && p.images.length > 0
          ? p.images.filter(
              (x): x is string => typeof x === "string" && x.trim().length > 0,
            )
          : p.imageUrl?.trim()
            ? [p.imageUrl.trim()]
            : [];
      const imageUrlFirst = imgs[0] ?? null;
      await client.query(
        `INSERT INTO compose_v2_posts (chat_id, post_index, label, theme, content, scheduled_date, status, published_at, linkedin_post_id, image_url, image_prompt, images)
         VALUES ($1::uuid, $2, $3, $4, $5, $6::timestamptz, $7, $8::timestamptz, $9, $10, $11, $12::jsonb)
         ON CONFLICT (chat_id, post_index) DO NOTHING`,
        [
          c.id,
          p.index,
          p.label,
          p.theme,
          p.content,
          p.scheduledDate,
          p.status,
          p.publishedAt ?? null,
          p.linkedinPostId ?? null,
          imageUrlFirst,
          p.imagePrompt ?? null,
          JSON.stringify(imgs),
        ],
      );
    }
  }
}

async function importApprovals(client: PoolClient, rows: JsonApproval[]) {
  for (const a of rows) {
    const imgs =
      Array.isArray(a.images) && a.images.length > 0
        ? a.images.filter(
            (x): x is string => typeof x === "string" && x.trim().length > 0,
          )
        : a.imageUrl?.trim()
          ? [a.imageUrl.trim()]
          : [];
    const imageUrlFirst = imgs[0] ?? null;
    await client.query(
      `INSERT INTO scheduled_approvals (id, chat_id, chat_title, post_index, label, theme, content, scheduled_date, status, published_at, linkedin_post_id, rejected_at, image_url, image_prompt, images)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10::timestamptz, $11, $12::timestamptz, $13, $14, $15::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [
        a.id,
        a.chatId,
        a.chatTitle,
        a.postIndex,
        a.label,
        a.theme,
        a.content,
        a.scheduledDate,
        a.status,
        a.publishedAt,
        a.linkedinPostId,
        a.rejectedAt ?? null,
        imageUrlFirst,
        a.imagePrompt ?? null,
        JSON.stringify(imgs),
      ],
    );
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function importPublished(client: PoolClient, rows: JsonPublished[]) {
  for (const r of rows) {
    const id = r.id && UUID_RE.test(r.id) ? r.id : randomUUID();
    await client.query(
      `INSERT INTO published_posts (id, linkedin_post_id, content, week, theme, published_at)
       VALUES ($1::uuid, $2, $3, $4, $5, $6::timestamptz)
       ON CONFLICT (id) DO NOTHING`,
      [
        id,
        r.postId,
        r.content,
        r.week ?? null,
        r.theme ?? null,
        r.publishedAt,
      ],
    );
  }
}

async function main() {
  getPool();
  const chatsRaw = readJson<JsonChat[]>("chats.json");
  const approvalsRaw = readJson<JsonApproval[]>("approvals.json");
  const publishedRaw = readJson<JsonPublished[]>("published-posts.json");

  const chats = Array.isArray(chatsRaw) ? chatsRaw : [];
  const approvals = Array.isArray(approvalsRaw) ? approvalsRaw : [];
  const published = Array.isArray(publishedRaw) ? publishedRaw : [];

  if (chats.length === 0 && approvals.length === 0 && published.length === 0) {
    console.log("No data/*.json files to import (or empty arrays).");
    process.exit(0);
  }

  await withTransaction(async (client) => {
    if (chats.length) await importChats(client, chats);
    if (approvals.length) await importApprovals(client, approvals);
    if (published.length) await importPublished(client, published);
  });

  console.log(
    `Imported: ${chats.length} chats, ${approvals.length} approvals, ${published.length} published rows (skipped conflicts where ON CONFLICT DO NOTHING).`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
