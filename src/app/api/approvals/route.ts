import { readChats } from "@/lib/compose-v2-chats-store";
import { disambiguateLabels } from "@/lib/chat-display-label";
import type { ScheduledApprovalItem } from "@/lib/scheduled-approvals-store";
import { readScheduledApprovals } from "@/lib/scheduled-approvals-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export type ApprovalTiming = "due" | "upcoming" | "published" | "rejected";

export type EnrichedScheduledApproval = ScheduledApprovalItem & {
  isDue: boolean;
  timing: ApprovalTiming;
  daysUntil: number;
  /** Normalized from chats.json + disambiguated when titles collide. */
  displayChatTitle: string;
};

async function enrichApprovals(): Promise<EnrichedScheduledApproval[]> {
  const [approvals, chats] = await Promise.all([
    readScheduledApprovals(),
    readChats(),
  ]);
  const titleFromChats = new Map(
    chats.map((c) => [c.id, (c.title?.trim() || c.topic?.trim() || "(untitled)") as string]),
  );
  const fallbackTitleByChat = new Map<string, string>();
  for (const a of approvals) {
    if (!fallbackTitleByChat.has(a.chatId)) {
      fallbackTitleByChat.set(
        a.chatId,
        (a.chatTitle?.trim() || "(untitled)") as string,
      );
    }
  }
  const chatIdsOrdered: string[] = [];
  const seen = new Set<string>();
  for (const a of approvals) {
    if (!seen.has(a.chatId)) {
      seen.add(a.chatId);
      chatIdsOrdered.push(a.chatId);
    }
  }
  const displayByChatId = disambiguateLabels(chatIdsOrdered, (id) => {
    return titleFromChats.get(id) ?? fallbackTitleByChat.get(id) ?? "(untitled)";
  });
  const now = new Date();

  return approvals.map((a) => {
    const scheduledDate = new Date(a.scheduledDate);
    const diffMs = scheduledDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / 86400000);

    let timing: ApprovalTiming;
    if (a.status === "published") timing = "published";
    else if (a.status === "rejected") timing = "rejected";
    else if (diffMs <= 0) timing = "due";
    else timing = "upcoming";

    return {
      ...a,
      isDue: timing === "due",
      timing,
      daysUntil: diffDays > 0 ? diffDays : 0,
      displayChatTitle:
        displayByChatId.get(a.chatId) ??
        (a.chatTitle?.trim() || "(untitled)"),
    };
  });
}

export async function GET() {
  const enriched = await enrichApprovals();
  const order: Record<ApprovalTiming, number> = {
    due: 0,
    upcoming: 1,
    published: 2,
    rejected: 3,
  };
  enriched.sort((a, b) => {
    if (order[a.timing] !== order[b.timing]) {
      return order[a.timing] - order[b.timing];
    }
    return (
      new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime()
    );
  });
  return NextResponse.json({ success: true, approvals: enriched });
}
