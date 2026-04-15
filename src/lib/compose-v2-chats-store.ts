import fs from "node:fs";
import path from "node:path";

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

const FILE = path.join(process.cwd(), "data", "chats.json");

function ensureDir() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
}

export function readChats(): ComposeV2Chat[] {
  try {
    if (!fs.existsSync(FILE)) return [];
    const raw = fs.readFileSync(FILE, "utf8");
    const data = JSON.parse(raw) as unknown;
    return Array.isArray(data) ? (data as ComposeV2Chat[]) : [];
  } catch {
    return [];
  }
}

export function writeChats(chats: ComposeV2Chat[]) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(chats, null, 2), "utf8");
}

export function getChatById(id: string): ComposeV2Chat | undefined {
  return readChats().find((c) => c.id === id);
}

export function upsertChat(chat: ComposeV2Chat) {
  const chats = readChats();
  const idx = chats.findIndex((c) => c.id === chat.id);
  if (idx === -1) chats.push(chat);
  else chats[idx] = chat;
  writeChats(chats);
}

export function deleteChatById(id: string): boolean {
  const before = readChats();
  const chats = before.filter((c) => c.id !== id);
  if (chats.length === before.length) return false;
  writeChats(chats);
  return true;
}

export function updatePostInChat(
  chatId: string,
  postIndex: number,
  patch: Partial<ComposeV2Post>,
): boolean {
  const chats = readChats();
  const chat = chats.find((c) => c.id === chatId);
  if (!chat) return false;
  const post = chat.posts.find((p) => p.index === postIndex);
  if (!post) return false;
  Object.assign(post, patch);
  writeChats(chats);
  return true;
}
