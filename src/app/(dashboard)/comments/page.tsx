"use client";

import type { PublishedPostRecord } from "@/lib/published-posts-store";
import { useCallback, useEffect, useState } from "react";

const BG = "#0f0f0f";
const SURFACE = "#1a1a1a";
const SURFACE2 = "#222";
const ACCENT = "#0a66c2";
const BORDER = "rgba(255,255,255,0.08)";
type CommentRow = {
  id: string;
  author: string;
  text: string;
  createdAt: string | null;
};

type DraftState = {
  text: string;
  generating: boolean;
  sendState: "idle" | "sending" | "sent";
};

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} hours ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} days ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function CommentsPage() {
  const [posts, setPosts] = useState<PublishedPostRecord[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [selected, setSelected] = useState<PublishedPostRecord | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, DraftState>>({});
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error" | "neutral";
  } | null>(null);

  const showToast = useCallback(
    (message: string, variant: "success" | "error" | "neutral" = "neutral") => {
      setToast({ message, variant });
    },
    [],
  );

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  async function loadPosts() {
    setPostsLoading(true);
    try {
      const res = await fetch("/api/comments/posts");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(typeof data.error === "string" ? data.error : "Load failed");
      }
      setPosts(Array.isArray(data.posts) ? data.posts : []);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not load posts.", "error");
      setPosts([]);
    } finally {
      setPostsLoading(false);
    }
  }

  useEffect(() => {
    void loadPosts();
  }, []);

  async function runSuggestions(postContent: string, list: CommentRow[]) {
    const initial: Record<string, DraftState> = {};
    for (const c of list) {
      initial[c.id] = { text: "", generating: true, sendState: "idle" };
    }
    setDrafts(initial);

    await Promise.all(
      list.map(async (c) => {
        try {
          const res = await fetch("/api/comments/suggest-reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              postContent,
              commentText: c.text,
              authorName: c.author,
            }),
          });
          const data = await res.json().catch(() => ({}));
          const suggestion =
            res.ok && typeof data.suggestion === "string" ? data.suggestion : "";
          setDrafts((prev) => ({
            ...prev,
            [c.id]: {
              text: suggestion,
              generating: false,
              sendState: "idle",
            },
          }));
        } catch {
          setDrafts((prev) => ({
            ...prev,
            [c.id]: {
              text: prev[c.id]?.text ?? "",
              generating: false,
              sendState: "idle",
            },
          }));
        }
      }),
    );
  }

  async function loadCommentsForPost(post: PublishedPostRecord) {
    setCommentsLoading(true);
    setComments([]);
    setDrafts({});
    try {
      const path = encodeURIComponent(post.postId);
      const res = await fetch(`/api/comments/fetch/${path}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Failed to fetch comments.";
        throw new Error(msg);
      }
      const list = Array.isArray(data.comments) ? (data.comments as CommentRow[]) : [];
      setComments(list);
      if (list.length > 0) {
        void runSuggestions(post.content, list);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Fetch failed", "error");
    } finally {
      setCommentsLoading(false);
    }
  }

  function selectPost(post: PublishedPostRecord) {
    setSelected(post);
    void loadCommentsForPost(post);
  }

  function updateDraft(commentId: string, text: string) {
    setDrafts((prev) => ({
      ...prev,
      [commentId]: {
        text,
        generating: prev[commentId]?.generating ?? false,
        sendState: prev[commentId]?.sendState ?? "idle",
      },
    }));
  }

  async function sendReply(comment: CommentRow) {
    if (!selected) return;
    const replyText = (drafts[comment.id]?.text ?? "").trim();
    if (!replyText) {
      showToast("Reply cannot be empty.", "error");
      return;
    }
    setDrafts((prev) => ({
      ...prev,
      [comment.id]: {
        ...prev[comment.id],
        sendState: "sending",
      },
    }));
    try {
      const res = await fetch("/api/comments/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: selected.postId,
          commentId: comment.id,
          replyText,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Send failed",
        );
      }
      setDrafts((prev) => ({
        ...prev,
        [comment.id]: {
          ...prev[comment.id],
          sendState: "sent",
        },
      }));
      showToast("Reply sent!", "success");
    } catch (e) {
      setDrafts((prev) => ({
        ...prev,
        [comment.id]: {
          ...prev[comment.id],
          sendState: "idle",
        },
      }));
      showToast(e instanceof Error ? e.message : "Failed to send.", "error");
    }
  }

  const toastBorder =
    toast?.variant === "success"
      ? "border-[#0a66c2]/45"
      : toast?.variant === "error"
        ? "border-rose-500/40"
        : "border-white/10";

  return (
    <div
      className="flex min-h-screen text-zinc-100"
      style={{ backgroundColor: BG }}
    >
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div
          className="shrink-0 overflow-y-auto border-b md:w-[35%] md:max-w-[35%] md:border-b-0 md:border-r"
          style={{
            width: "100%",
            borderColor: BORDER,
            backgroundColor: BG,
          }}
        >
          <div
            className="sticky top-0 z-10 border-b px-4 py-3 text-sm font-medium text-zinc-300"
            style={{ borderColor: BORDER, backgroundColor: SURFACE }}
          >
            Published posts
          </div>
          {postsLoading ? (
            <p className="p-4 text-sm text-zinc-500">Loading…</p>
          ) : posts.length === 0 ? (
            <p className="p-4 text-sm text-zinc-500">
              No posts yet. Publish a post from Compose V2 first.
            </p>
          ) : (
            <ul>
              {posts.map((p) => {
                const active = selected?.id === p.id;
                const preview =
                  p.content.length > 100
                    ? `${p.content.slice(0, 100)}…`
                    : p.content;
                const dateStr = new Date(p.publishedAt).toLocaleDateString(
                  undefined,
                  { month: "short", day: "numeric", year: "numeric" },
                );
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => selectPost(p)}
                      className="w-full cursor-pointer border-b px-4 py-3.5 text-left text-sm transition hover:bg-white/[0.04]"
                      style={{
                        borderColor: BORDER,
                        backgroundColor: active
                          ? "rgba(10,102,194,0.12)"
                          : "transparent",
                        borderLeft: active ? `2px solid ${ACCENT}` : "2px solid transparent",
                      }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                          style={{ backgroundColor: ACCENT }}
                        >
                          {p.week != null ? `Week ${p.week}` : "Direct Post"}
                        </span>
                        {p.theme ? (
                          <span className="truncate font-medium text-zinc-200">
                            {p.theme}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-zinc-500">
                        {preview}
                      </p>
                      <p className="mt-1 text-[11px] text-zinc-600">{dateStr}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div
          className="min-h-[50vh] flex-1 overflow-y-auto p-6"
          style={{ backgroundColor: BG }}
        >
          {!selected ? (
            <p className="text-sm text-zinc-500">
              Select a post to load comments and draft replies.
            </p>
          ) : (
            <>
              <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded px-2 py-0.5 text-[10px] font-bold uppercase text-white"
                      style={{ backgroundColor: ACCENT }}
                    >
                      {selected.week != null ? `Week ${selected.week}` : "Direct Post"}
                    </span>
                    {selected.theme ? (
                      <h2 className="text-lg font-semibold text-white">
                        {selected.theme}
                      </h2>
                    ) : (
                      <h2 className="text-lg font-semibold text-white">Post</h2>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-3 text-xs text-zinc-500">
                    {selected.content}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={commentsLoading}
                  onClick={() => void loadCommentsForPost(selected)}
                  className="rounded-md border border-white/15 bg-transparent px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-50"
                >
                  {commentsLoading ? "Refreshing…" : "Refresh Comments"}
                </button>
              </div>

              {commentsLoading ? (
                <div className="flex flex-col items-center py-16">
                  <div
                    className="h-9 w-9 animate-spin rounded-full border-2 border-zinc-600 border-t-transparent"
                    style={{ borderTopColor: ACCENT }}
                  />
                  <p className="mt-3 text-sm text-zinc-500">Loading comments…</p>
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-zinc-500">
                  No comments on this post yet.
                </p>
              ) : (
                <ul className="space-y-4">
                  {comments.map((c) => {
                    const d = drafts[c.id];
                    const generating = d?.generating ?? true;
                    const sendState = d?.sendState ?? "idle";
                    const initial = d?.text ?? "";
                    const authorInitial = (c.author[0] || "?").toUpperCase();
                    return (
                      <li
                        key={c.id}
                        className="rounded-xl border p-4"
                        style={{
                          backgroundColor: SURFACE,
                          borderColor: BORDER,
                        }}
                      >
                        <div className="mb-2 flex items-start gap-3">
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                            style={{
                              backgroundColor: "rgba(10,102,194,0.25)",
                              color: "#1d8aff",
                            }}
                          >
                            {authorInitial}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-100">
                              {c.author}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {timeAgo(c.createdAt)}
                            </p>
                          </div>
                        </div>
                        <p className="mb-3 text-sm italic leading-relaxed text-zinc-400">
                          &ldquo;{c.text}&rdquo;
                        </p>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                          AI suggested reply
                        </p>
                        <textarea
                          value={initial}
                          disabled={generating || sendState === "sent"}
                          onChange={(e) => updateDraft(c.id, e.target.value)}
                          placeholder={
                            generating
                              ? "Generating AI suggestion…"
                              : "Edit reply here…"
                          }
                          rows={4}
                          className="w-full resize-y rounded-lg border px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-[#0a66c2] disabled:opacity-60"
                          style={{
                            backgroundColor: SURFACE2,
                            borderColor: "rgba(255,255,255,0.14)",
                            minHeight: 80,
                          }}
                        />
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            disabled={
                              generating ||
                              sendState === "sending" ||
                              sendState === "sent"
                            }
                            onClick={() => void sendReply(c)}
                            className="rounded-md border-none px-5 py-2 text-[13px] font-medium text-white transition hover:bg-[#1d8aff] disabled:cursor-not-allowed disabled:opacity-45"
                            style={{
                              backgroundColor:
                                sendState === "sent" ? "#1db954" : ACCENT,
                            }}
                          >
                            {sendState === "sending"
                              ? "Sending…"
                              : sendState === "sent"
                                ? "✓ Sent"
                                : "Send Reply"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-lg border px-4 py-3 text-center text-sm text-white shadow-lg ${toastBorder}`}
          style={{ backgroundColor: SURFACE }}
          role="status"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
