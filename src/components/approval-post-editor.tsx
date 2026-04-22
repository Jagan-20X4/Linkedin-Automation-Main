"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Busy = { dirty: boolean; saving: boolean };

type Props = {
  approvalId: string;
  serverContent: string;
  canEdit: boolean;
  onBusyChange: (id: string, state: Busy) => void;
  onSaved?: () => void | Promise<void>;
};

const AUTOSAVE_DEBOUNCE_MS = 900;
const SAVED_HINT_MS = 2000;

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
  const [showSavedHint, setShowSavedHint] = useState(false);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftRef = useRef(draft);
  const savedHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  draftRef.current = draft;

  const clearDebounce = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const clearSavedHintTimer = useCallback(() => {
    if (savedHintTimerRef.current) {
      clearTimeout(savedHintTimerRef.current);
      savedHintTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    setDraft(serverContent);
  }, [approvalId, serverContent]);

  const dirty = draft !== serverContent;

  useEffect(() => {
    onBusyChange(approvalId, { dirty, saving });
    return () => onBusyChange(approvalId, { dirty: false, saving: false });
  }, [approvalId, dirty, saving, onBusyChange]);

  const performSave = useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
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
        clearSavedHintTimer();
        setShowSavedHint(true);
        savedHintTimerRef.current = setTimeout(() => {
          savedHintTimerRef.current = null;
          setShowSavedHint(false);
        }, SAVED_HINT_MS);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Save failed");
      } finally {
        setSaving(false);
      }
    },
    [approvalId, onSaved, clearSavedHintTimer],
  );

  useEffect(() => {
    clearDebounce();
    if (draft === serverContent) return undefined;
    const trimmed = draft.trim();
    if (!trimmed) return undefined;
    if (saving) return undefined;

    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void performSave(draftRef.current);
    }, AUTOSAVE_DEBOUNCE_MS);

    return clearDebounce;
  }, [draft, serverContent, saving, performSave, clearDebounce]);

  useEffect(
    () => () => {
      clearDebounce();
      clearSavedHintTimer();
    },
    [clearDebounce, clearSavedHintTimer],
  );

  const discard = useCallback(() => {
    clearDebounce();
    setDraft(serverContent);
    setErr(null);
    setShowSavedHint(false);
    clearSavedHintTimer();
  }, [clearDebounce, clearSavedHintTimer, serverContent]);

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
          setShowSavedHint(false);
          clearSavedHintTimer();
        }}
        spellCheck
        className="min-h-[14rem] w-full resize-y rounded-md border border-white/15 bg-black/30 px-3 py-2 font-sans text-sm leading-relaxed text-zinc-200 outline-none ring-[#0a66c2]/30 focus:ring-2"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={discard}
          disabled={!dirty || saving}
          className="rounded-md border border-white/15 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-45"
        >
          Discard
        </button>
        <span className="text-xs text-zinc-500" aria-live="polite">
          {saving ? (
            <span className="text-sky-300/90">Saving…</span>
          ) : showSavedHint ? (
            <span className="text-emerald-300/90">Saved</span>
          ) : dirty ? (
            <span className="text-zinc-400">Autosaves when you pause typing.</span>
          ) : null}
        </span>
        {err ? <span className="text-xs text-rose-300">{err}</span> : null}
      </div>
    </div>
  );
}
