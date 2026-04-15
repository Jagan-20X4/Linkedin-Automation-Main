import type { ScheduledApprovalItem } from "@/lib/scheduled-approvals-store";
import { readScheduledApprovals } from "@/lib/scheduled-approvals-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export type ApprovalTiming = "due" | "upcoming" | "published" | "rejected";

export type EnrichedScheduledApproval = ScheduledApprovalItem & {
  isDue: boolean;
  timing: ApprovalTiming;
  daysUntil: number;
};

function enrichApprovals(): EnrichedScheduledApproval[] {
  const approvals = readScheduledApprovals();
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
    };
  });
}

export async function GET() {
  const enriched = enrichApprovals();
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
