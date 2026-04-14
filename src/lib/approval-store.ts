export type DraftRecord = {
  text: string;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  updatedAt: number;
  linkedinPosted?: boolean;
  linkedinError?: string;
};

const drafts = new Map<string, DraftRecord>();

export function createDraft(text: string): string {
  const id = crypto.randomUUID();
  const now = Date.now();
  drafts.set(id, { text, status: "pending", createdAt: now, updatedAt: now });
  return id;
}

export function getDraft(id: string): DraftRecord | undefined {
  return drafts.get(id);
}

export function setDraftStatus(
  id: string,
  status: DraftRecord["status"],
): DraftRecord | undefined {
  const row = drafts.get(id);
  if (!row) return undefined;
  const next = { ...row, status, updatedAt: Date.now() };
  drafts.set(id, next);
  return next;
}

export function setDraftLinkedInResult(
  id: string,
  result: { posted: boolean; error?: string },
): DraftRecord | undefined {
  const row = drafts.get(id);
  if (!row) return undefined;
  const next = {
    ...row,
    linkedinPosted: result.posted,
    linkedinError: result.error,
    updatedAt: Date.now(),
  };
  drafts.set(id, next);
  return next;
}
