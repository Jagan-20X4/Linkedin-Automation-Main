import type { PoolClient } from "pg";
import { getPool, withTransaction } from "@/lib/db";

export type ScheduledApprovalItem = {
  id: string;
  chatId: string;
  chatTitle: string;
  postIndex: number;
  label: string;
  theme: string;
  content: string;
  scheduledDate: string;
  status: "pending" | "published" | "rejected";
  publishedAt: string | null;
  linkedinPostId: string | null;
  rejectedAt?: string | null;
};

function mapApprovalRow(r: {
  id: string;
  chat_id: string;
  chat_title: string;
  post_index: number;
  label: string;
  theme: string;
  content: string;
  scheduled_date: Date;
  status: string;
  published_at: Date | null;
  linkedin_post_id: string | null;
  rejected_at: Date | null;
}): ScheduledApprovalItem {
  return {
    id: r.id,
    chatId: r.chat_id,
    chatTitle: r.chat_title,
    postIndex: r.post_index,
    label: r.label,
    theme: r.theme,
    content: r.content,
    scheduledDate:
      r.scheduled_date instanceof Date
        ? r.scheduled_date.toISOString()
        : String(r.scheduled_date),
    status: r.status as ScheduledApprovalItem["status"],
    publishedAt: r.published_at
      ? r.published_at instanceof Date
        ? r.published_at.toISOString()
        : String(r.published_at)
      : null,
    linkedinPostId: r.linkedin_post_id,
    rejectedAt: r.rejected_at
      ? r.rejected_at instanceof Date
        ? r.rejected_at.toISOString()
        : String(r.rejected_at)
      : null,
  };
}

export async function readScheduledApprovals(): Promise<ScheduledApprovalItem[]> {
  const pool = getPool();
  const res = await pool.query<{
    id: string;
    chat_id: string;
    chat_title: string;
    post_index: number;
    label: string;
    theme: string;
    content: string;
    scheduled_date: Date;
    status: string;
    published_at: Date | null;
    linkedin_post_id: string | null;
    rejected_at: Date | null;
  }>(
    `SELECT id, chat_id, chat_title, post_index, label, theme, content, scheduled_date, status, published_at, linkedin_post_id, rejected_at
     FROM scheduled_approvals`,
  );
  return res.rows.map(mapApprovalRow);
}

export async function removeApprovalsForChat(chatId: string): Promise<void> {
  const pool = getPool();
  await pool.query(`DELETE FROM scheduled_approvals WHERE chat_id = $1::uuid`, [chatId]);
}

export async function replacePendingApprovalsForChat(
  chatId: string,
  newItems: ScheduledApprovalItem[],
): Promise<void> {
  await withTransaction(async (c) => {
    await replacePendingApprovalsForChatClient(c, chatId, newItems);
  });
}

/** For use inside an existing transaction (e.g. with generate). */
export async function replacePendingApprovalsForChatClient(
  client: PoolClient,
  chatId: string,
  newItems: ScheduledApprovalItem[],
): Promise<void> {
  await client.query(
    `DELETE FROM scheduled_approvals WHERE chat_id = $1::uuid AND status = 'pending'`,
    [chatId],
  );
  for (const a of newItems) {
    await client.query(
      `INSERT INTO scheduled_approvals (id, chat_id, chat_title, post_index, label, theme, content, scheduled_date, status, published_at, linkedin_post_id, rejected_at)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8::timestamptz, $9, $10::timestamptz, $11, $12::timestamptz)`,
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
      ],
    );
  }
}

export async function getApprovalById(
  id: string,
): Promise<ScheduledApprovalItem | undefined> {
  const pool = getPool();
  const res = await pool.query<{
    id: string;
    chat_id: string;
    chat_title: string;
    post_index: number;
    label: string;
    theme: string;
    content: string;
    scheduled_date: Date;
    status: string;
    published_at: Date | null;
    linkedin_post_id: string | null;
    rejected_at: Date | null;
  }>(
    `SELECT id, chat_id, chat_title, post_index, label, theme, content, scheduled_date, status, published_at, linkedin_post_id, rejected_at
     FROM scheduled_approvals WHERE id = $1::uuid`,
    [id],
  );
  const row = res.rows[0];
  return row ? mapApprovalRow(row) : undefined;
}

export async function updateApproval(
  id: string,
  patch: Partial<ScheduledApprovalItem>,
): Promise<boolean> {
  const pool = getPool();
  const sets: string[] = [];
  const values: unknown[] = [id];
  let n = 2;
  if (patch.chatTitle !== undefined) {
    sets.push(`chat_title = $${n++}`);
    values.push(patch.chatTitle);
  }
  if (patch.postIndex !== undefined) {
    sets.push(`post_index = $${n++}`);
    values.push(patch.postIndex);
  }
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
  if (patch.rejectedAt !== undefined) {
    sets.push(`rejected_at = $${n++}`);
    values.push(patch.rejectedAt);
  }
  if (sets.length === 0) return false;
  const res = await pool.query(
    `UPDATE scheduled_approvals SET ${sets.join(", ")} WHERE id = $1::uuid`,
    values,
  );
  return res.rowCount !== null && res.rowCount > 0;
}

export async function updateApprovalByChatPost(
  chatId: string,
  postIndex: number,
  patch: Partial<ScheduledApprovalItem>,
): Promise<boolean> {
  const pool = getPool();
  const sets: string[] = [];
  const values: unknown[] = [chatId, postIndex];
  let n = 3;
  if (patch.chatTitle !== undefined) {
    sets.push(`chat_title = $${n++}`);
    values.push(patch.chatTitle);
  }
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
  if (patch.rejectedAt !== undefined) {
    sets.push(`rejected_at = $${n++}`);
    values.push(patch.rejectedAt);
  }
  if (sets.length === 0) return false;
  const res = await pool.query(
    `UPDATE scheduled_approvals SET ${sets.join(", ")} WHERE chat_id = $1::uuid AND post_index = $2`,
    values,
  );
  return res.rowCount !== null && res.rowCount > 0;
}
