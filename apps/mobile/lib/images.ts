import type { ApprovalTiming, ComposePost, ScheduledApprovalRow } from "./types";

export function postImageList(p: ComposePost): string[] {
  if (Array.isArray(p.images) && p.images.length > 0) return p.images;
  if (p.imageUrl?.trim()) return [p.imageUrl.trim()];
  return [];
}

export function approvalImageList(a: ScheduledApprovalRow): string[] {
  if (Array.isArray(a.images) && a.images.length > 0) return a.images;
  if (a.imageUrl?.trim()) return [a.imageUrl.trim()];
  return [];
}

export function resolveApprovalTiming(a: ScheduledApprovalRow): ApprovalTiming {
  if (a.timing) return a.timing;
  if (a.status === "published") return "published";
  if (a.status === "rejected") return "rejected";
  if (a.isDue) return "due";
  return "upcoming";
}
