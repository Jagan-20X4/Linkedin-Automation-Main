"use client";

import { useCallback, useEffect, useState } from "react";

type Busy = { dirty: boolean; saving: boolean };

type Props = {
  approvalId: string;
  serverContent: string;
  canEdit: boolean;
  onBusyChange: (id: string, state: Busy) => void;
  onSaved?: () => void | Promise<void>;
};

export function ApprovalPostEditor({
  approvalId,
  serverContent,
  canEdit,
  onBusyChange,
  onSaved,
}: Props) {
  const [draft, setDraft] = useState(serverContent);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setDraft(serverContent);
  }, [approvalId, serverContent]);

  const dirty = draft !== serverContent;

  useEffect(() => {
    onBusyChange(approvalId, { dirty, saving });
    return () => onBusyChange(approvalId, { dirty: false, saving: false });
  }, [approvalId, dirty, saving, onBusyChange]);

  const save = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setErr("Post cannot be empty.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/approvals/${encodeURIComponent(approvalId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      }
      await onSaved?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [approvalId, draft, onSaved]);

  if (!canEdit) {
    return (
      <div className="border-t border-white/10 px-3 py-2">
        <pre className="max-h-[min(28rem,70vh)] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-zinc-300">
          {serverContent}
        </pre>
      </div>
    );
  }

  return (
    <div className="space-y-2 border-t border-white/10 px-3 py-2">
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setErr(null);
        }}
        spellCheck
        className="min-h-[14rem] w-full resize-y rounded-md border border-white/15 bg-black/30 px-3 py-2 font-sans text-sm leading-relaxed text-zinc-200 outline-none ring-[#0a66c2]/30 focus:ring-2"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="rounded-md bg-[#0a66c2] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1d8aff] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(serverContent);
            setErr(null);
          }}
          disabled={!dirty || saving}
          className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Discard
        </button>
        {dirty ? (
          <span className="text-xs text-amber-200/90">
            Unsaved changes — save before publishing.
          </span>
        ) : null}
        {err ? <span className="text-xs text-rose-300">{err}</span> : null}
      </div>
    </div>
  );
}
