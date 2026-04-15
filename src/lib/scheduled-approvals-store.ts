import fs from "node:fs";
import path from "node:path";

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

const FILE = path.join(process.cwd(), "data", "approvals.json");

function ensureDir() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
}

export function readScheduledApprovals(): ScheduledApprovalItem[] {
  try {
    if (!fs.existsSync(FILE)) return [];
    const raw = fs.readFileSync(FILE, "utf8");
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? (data as ScheduledApprovalItem[]) : [];
  } catch {
    return [];
  }
}

export function writeScheduledApprovals(items: ScheduledApprovalItem[]) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(items, null, 2), "utf8");
}

export function removeApprovalsForChat(chatId: string) {
  const items = readScheduledApprovals().filter((a) => a.chatId !== chatId);
  writeScheduledApprovals(items);
}

export function replacePendingApprovalsForChat(
  chatId: string,
  newItems: ScheduledApprovalItem[],
) {
  const rest = readScheduledApprovals().filter((a) => a.chatId !== chatId);
  writeScheduledApprovals([...rest, ...newItems]);
}

export function getApprovalById(id: string): ScheduledApprovalItem | undefined {
  return readScheduledApprovals().find((a) => a.id === id);
}

export function updateApproval(
  id: string,
  patch: Partial<ScheduledApprovalItem>,
): boolean {
  const items = readScheduledApprovals();
  const idx = items.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  items[idx] = { ...items[idx], ...patch };
  writeScheduledApprovals(items);
  return true;
}

export function updateApprovalByChatPost(
  chatId: string,
  postIndex: number,
  patch: Partial<ScheduledApprovalItem>,
): boolean {
  const items = readScheduledApprovals();
  const idx = items.findIndex(
    (a) => a.chatId === chatId && a.postIndex === postIndex,
  );
  if (idx === -1) return false;
  items[idx] = { ...items[idx], ...patch };
  writeScheduledApprovals(items);
  return true;
}
