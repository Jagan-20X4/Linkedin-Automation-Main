export type ChatSummary = {
  id: string;
  title: string;
  displayTitle?: string;
  durationType: "weeks" | "months";
  durationValue: number;
  postCount: number;
  createdAt: string;
};

export type ComposePost = {
  index: number;
  label: string;
  theme: string;
  content: string;
  scheduledDate: string;
  status: "pending" | "published" | "rejected";
  publishedAt?: string | null;
  linkedinPostId?: string | null;
  images?: string[];
  imageUrl?: string | null;
  imagePrompt?: string | null;
};

export type ComposeChat = {
  id: string;
  title: string;
  topic: string;
  durationType: "weeks" | "months";
  durationValue: number;
  posts: ComposePost[];
  createdAt: string;
  updatedAt?: string;
};

export type ApprovalTiming = "due" | "upcoming" | "published" | "rejected";

export type ScheduledApprovalRow = {
  id: string;
  chatId: string;
  chatTitle: string;
  displayChatTitle?: string;
  postIndex: number;
  label: string;
  theme: string;
  content: string;
  scheduledDate: string;
  status: "pending" | "published" | "rejected";
  publishedAt: string | null;
  linkedinPostId: string | null;
  rejectedAt?: string | null;
  images?: string[];
  imageUrl?: string | null;
  isDue?: boolean;
  timing?: ApprovalTiming;
  daysUntil?: number;
};

export type PublishedPostRecord = {
  id: string;
  postId: string;
  content: string;
  week: number | null;
  theme: string | null;
  publishedAt: string;
};

export type CommentRow = {
  id: string;
  author: string;
  text: string;
  createdAt: string | null;
};
