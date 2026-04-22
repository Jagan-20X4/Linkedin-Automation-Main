"use client";

import { ComposeV2ChatListSkeleton } from "@/components/list-skeletons";
import { PostImagesGallery } from "@/components/post-images-gallery";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const BG = "var(--app-bg)";
const SURFACE = "var(--app-surface)";
const ACCENT = "#0a66c2";
const LS_CHAT_PANEL_VISIBLE = "chatPanelVisible";

type ChatSummary = {
  id: string;
  title: string;
  /** When two chats share the same title, includes a short id suffix. */
  displayTitle?: string;
  durationType: "weeks" | "months";
  durationValue: number;
  postCount: number;
  createdAt: string;
};

type ComposePost = {
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

type ComposeChat = {
  id: string;
  title: string;
  topic: string;
  durationType: "weeks" | "months";
  durationValue: number;
  posts: ComposePost[];
  createdAt: string;
  updatedAt?: string;
};

type ToastState = { message: string; variant: "neutral" | "success" | "error" };

function formatScheduled(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatCreated(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function isDueNow(post: ComposePost): boolean {
  if (post.status !== "pending") return false;
  return new Date(post.scheduledDate) <= new Date();
}

function postImageList(p: ComposePost): string[] {
  if (Array.isArray(p.images) && p.images.length > 0) return p.images;
  if (p.imageUrl?.trim()) return [p.imageUrl.trim()];
  return [];
}

function ComposeV2Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  /** Tracks which chat was last loaded so refetches of the same chat do not reset expand/collapse. */
  const loadedChatIdRef = useRef<string | null>(null);

  const [allChats, setAllChats] = useState<ChatSummary[]>([]);
  const [activeChat, setActiveChat] = useState<ComposeChat | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [weeksInput, setWeeksInput] = useState("");
  const [monthsInput, setMonthsInput] = useState("");
  const [loading, setLoading] = useState(false);
  /** Post count for loading copy (Imagen + Claude timing). */
  const [generatePlanCount, setGeneratePlanCount] = useState<number | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [publishingIndex, setPublishingIndex] = useState<number | null>(null);
  /** `${postIndex}-add` | `${postIndex}-del-${i}` while an image API call runs. */
  const [postImageBusyKey, setPostImageBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [chatPanelVisible, setChatPanelVisible] = useState(true);

  const showToast = useCallback((message: string, variant: ToastState["variant"] = "neutral") => {
    setToast({ message, variant });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (copiedIndex == null) return;
    const t = setTimeout(() => setCopiedIndex(null), 2000);
    return () => clearTimeout(t);
  }, [copiedIndex]);

  const loadChatList = useCallback(async () => {
    try {
      const res = await fetch("/api/v2/chats");
      const data = (await res.json()) as { success?: boolean; chats?: ChatSummary[] };
      if (data.chats) setAllChats(data.chats);
    } catch {
      showToast("Could not load chats.", "error");
    } finally {
      setLoadingList(false);
    }
  }, [showToast]);

  const loadChat = useCallback(
    async (chatId: string) => {
      try {
        const res = await fetch(`/api/v2/chats/${encodeURIComponent(chatId)}`);
        const data = (await res.json()) as { success?: boolean; chat?: ComposeChat; error?: string };
        if (!res.ok || !data.chat) {
          throw new Error(typeof data.error === "string" ? data.error : "Chat not found");
        }
        const chat = data.chat;
        const previousLoadedId = loadedChatIdRef.current;
        loadedChatIdRef.current = chat.id;

        setActiveChat(chat);
        setTopic(chat.topic);
        if (chat.durationType === "weeks") {
          setWeeksInput(String(chat.durationValue));
          setMonthsInput("");
        } else {
          setMonthsInput(String(chat.durationValue));
          setWeeksInput("");
        }
        const posts = [...chat.posts].sort((a, b) => a.index - b.index);
        if (chat.id !== previousLoadedId) {
          setExpanded(new Set([posts[0]?.index ?? 1]));
        }
        setComposerOpen(true);
        router.replace(`/compose-v2?chatId=${encodeURIComponent(chatId)}`, { scroll: false });
        if (typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches) {
          setChatPanelVisible(false);
        }
      } catch (e) {
        showToast(e instanceof Error ? e.message : "Load failed", "error");
      }
    },
    [router, showToast],
  );

  useEffect(() => {
    void loadChatList();
  }, [loadChatList]);

  useEffect(() => {
    try {
      const isLg =
        typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
      if (!isLg) {
        setChatPanelVisible(false);
        return;
      }
      const v = localStorage.getItem(LS_CHAT_PANEL_VISIBLE);
      if (v === "false") setChatPanelVisible(false);
    } catch {
      /* ignore */
    }
  }, []);

  function toggleChatPanel(show: boolean) {
    setChatPanelVisible(show);
    try {
      localStorage.setItem(LS_CHAT_PANEL_VISIBLE, show ? "true" : "false");
    } catch {
      /* ignore */
    }
  }

  const chatIdFromUrl = searchParams.get("chatId");
  useEffect(() => {
    if (chatIdFromUrl) void loadChat(chatIdFromUrl);
  }, [chatIdFromUrl, loadChat]);

  function newChat() {
    loadedChatIdRef.current = null;
    setActiveChat(null);
    setTopic("");
    setWeeksInput("");
    setMonthsInput("");
    setExpanded(new Set());
    setComposerOpen(true);
    router.replace("/compose-v2", { scroll: false });
  }

  async function handleGenerate() {
    const topicTrim = topic.trim();
    if (!topicTrim) {
      showToast("Please enter a topic.", "error");
      return;
    }
    const weeksVal = parseInt(weeksInput, 10);
    const monthsVal = parseInt(monthsInput, 10);
    let durationType: "weeks" | "months";
    let durationValue: number;
    if (Number.isFinite(weeksVal) && weeksVal > 0) {
      durationType = "weeks";
      durationValue = weeksVal;
    } else if (Number.isFinite(monthsVal) && monthsVal > 0) {
      durationType = "months";
      durationValue = monthsVal;
    } else {
      showToast("Please enter weeks or months.", "error");
      return;
    }

    setGeneratePlanCount(durationValue);
    setLoading(true);
    try {
      const res = await fetch("/api/v2/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topicTrim,
          durationType,
          durationValue,
          chatId: activeChat?.id ?? null,
        }),
      });
      const data = (await res.json()) as {
        success?: boolean;
        chat?: ComposeChat;
        error?: string;
        details?: string;
      };
      if (!res.ok || !data.success || !data.chat) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : typeof data.details === "string"
              ? data.details
              : "Generation failed",
        );
      }
      setActiveChat(data.chat);
      loadedChatIdRef.current = data.chat.id;
      const posts = [...data.chat.posts].sort((a, b) => a.index - b.index);
      setExpanded(new Set([posts[0]?.index ?? 1]));
      await loadChatList();
      router.replace(`/compose-v2?chatId=${encodeURIComponent(data.chat.id)}`, { scroll: false });
      showToast(`${durationValue} ${durationType} plan generated!`, "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error", "error");
    } finally {
      setLoading(false);
      setGeneratePlanCount(null);
    }
  }

  async function handleDeleteChat(e: React.MouseEvent, chatId: string) {
    e.stopPropagation();
    if (!confirm("Delete this chat and all its scheduled posts?")) return;
    const prevList = allChats;
    setAllChats((p) => p.filter((c) => c.id !== chatId));
    try {
      const res = await fetch(`/api/v2/chats/${encodeURIComponent(chatId)}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Could not delete chat.",
        );
      }
      if (activeChat?.id === chatId) newChat();
      showToast("Chat and its approvals removed.", "success");
      void loadChatList();
    } catch (err) {
      setAllChats(prevList);
      showToast(err instanceof Error ? err.message : "Delete failed", "error");
    }
  }

  function togglePost(index: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function copyPost(e: React.MouseEvent, text: string, index: number) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
    } catch {
      showToast("Could not copy.", "error");
    }
  }

  async function publishPost(e: React.MouseEvent, content: string, postIndex: number) {
    e.stopPropagation();
    if (!activeChat) return;
    setPublishingIndex(postIndex);
    try {
      const res = await fetch("/api/v2/publish-linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          chatId: activeChat.id,
          postIndex,
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !data.success) {
        throw new Error(typeof data.error === "string" ? data.error : "Publish failed");
      }
      showToast("Published to LinkedIn!", "success");
      await loadChat(activeChat.id);
      await loadChatList();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Publish failed", "error");
    } finally {
      setPublishingIndex(null);
    }
  }

  async function addPostImage(postIndex: number, file: File) {
    if (!activeChat) return;
    setPostImageBusyKey(`${postIndex}-add`);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/v2/chats/${encodeURIComponent(activeChat.id)}/posts/${postIndex}/images`,
        { method: "POST", body: fd },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
      }
      await loadChat(activeChat.id);
      showToast("Image added.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed", "error");
    } finally {
      setPostImageBusyKey(null);
    }
  }

  async function removePostImage(postIndex: number, imageIndex: number) {
    if (!activeChat) return;
    setPostImageBusyKey(`${postIndex}-del-${imageIndex}`);
    try {
      const res = await fetch(
        `/api/v2/chats/${encodeURIComponent(activeChat.id)}/posts/${postIndex}/images/${imageIndex}`,
        { method: "DELETE" },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Remove failed");
      }
      await loadChat(activeChat.id);
      showToast("Image removed.", "neutral");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Remove failed", "error");
    } finally {
      setPostImageBusyKey(null);
    }
  }

  const sortedPosts = useMemo(() => {
    if (!activeChat?.posts?.length) return [];
    return [...activeChat.posts].sort((a, b) => a.index - b.index);
  }, [activeChat]);

  const showEmptySplash =
    !activeChat && !composerOpen && !loading && sortedPosts.length === 0;

  const durationBadge = (c: ChatSummary) =>
    `${c.durationValue} ${c.durationType === "weeks" ? "Weeks" : "Months"}`;

  const toastBorder =
    toast?.variant === "success"
      ? "border-[#0a66c2]/45"
      : toast?.variant === "error"
        ? "border-rose-500/40"
        : "border-white/10";

  return (
    <div
      className="flex min-h-0 flex-1 flex-col text-zinc-100 lg:min-h-screen lg:flex-row"
      style={{ backgroundColor: BG }}
    >
      {!chatPanelVisible ? (
        <div
          className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2 lg:hidden"
          style={{ backgroundColor: SURFACE }}
        >
          <button
            type="button"
            onClick={() => toggleChatPanel(true)}
            className="min-h-11 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:border-[#0a66c2]/50 hover:bg-white/5"
          >
            Chats
          </button>
          <button
            type="button"
            aria-label="New chat"
            title="New chat"
            onClick={() => newChat()}
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 text-lg font-semibold leading-none text-zinc-100 transition hover:border-[#0a66c2]/50 hover:bg-white/5"
            style={{ backgroundColor: ACCENT }}
          >
            +
          </button>
        </div>
      ) : null}
      {chatPanelVisible ? (
        <button
          type="button"
          aria-label="Close chat list"
          className="fixed inset-0 z-40 bg-black/65 lg:hidden"
          onClick={() => toggleChatPanel(false)}
        />
      ) : null}
      {!chatPanelVisible && (
        <div
          className="hidden shrink-0 flex-col border-r border-white/10 py-6 pl-2 pr-1 lg:flex"
          style={{ width: 44, backgroundColor: SURFACE }}
        >
          <button
            type="button"
            title="Show chats"
            onClick={() => toggleChatPanel(true)}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/15 text-sm text-zinc-400 transition hover:border-[#0a66c2] hover:text-[#1d8aff]"
          >
            →
          </button>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
        {chatPanelVisible && (
        <div
          className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100vw-1rem))] shrink-0 flex-col border-r border-white/10 py-6 pl-4 pr-3 shadow-2xl shadow-black/40 transition-[opacity,width] duration-200 ease-out lg:static lg:z-auto lg:w-[280px] lg:max-w-none lg:shadow-none"
          style={{ backgroundColor: SURFACE }}
        >
          <div className="mb-4 flex items-center justify-between gap-2 pr-1">
            <h2 className="text-sm font-semibold text-white">Chats</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={newChat}
                className="rounded-md px-2.5 py-1 text-xs font-semibold text-white"
                style={{ backgroundColor: ACCENT }}
              >
                (+) New Chat
              </button>
              <button
                type="button"
                title="Hide chats"
                onClick={() => toggleChatPanel(false)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/15 text-sm text-zinc-400 transition hover:border-[#0a66c2] hover:text-[#1d8aff]"
              >
                ←
              </button>
            </div>
          </div>
          {loadingList ? (
            <ComposeV2ChatListSkeleton />
          ) : allChats.length === 0 ? (
            <p className="text-xs text-zinc-500">No chats yet.</p>
          ) : (
            <ul className="max-h-[calc(100vh-8rem)] space-y-1 overflow-y-auto pr-1">
              {allChats.map((c) => {
                const isActive = activeChat?.id === c.id;
                const listTitle = c.displayTitle ?? c.title;
                const titleShort =
                  listTitle.length > 35 ? `${listTitle.slice(0, 35)}…` : listTitle;
                return (
                  <li key={c.id}>
                    <div
                      className={`flex w-full items-start gap-1 rounded-lg border border-transparent px-2 py-2 transition hover:border-white/10 hover:bg-white/5 ${
                        isActive ? "border-[#0a66c2]/40 bg-[#0a66c2]/15" : ""
                      }`}
                      style={
                        isActive
                          ? { borderLeft: `3px solid ${ACCENT}`, paddingLeft: "calc(0.5rem - 3px)" }
                          : {}
                      }
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => void loadChat(c.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            void loadChat(c.id);
                          }
                        }}
                        className="min-w-0 flex-1 cursor-pointer rounded-md px-1 py-0.5 text-left outline-none ring-[#0a66c2]/30 focus-visible:ring-2"
                      >
                        <span className="block truncate text-sm font-medium text-zinc-100">
                          {titleShort}
                        </span>
                        <span
                          className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
                          style={{ backgroundColor: ACCENT }}
                        >
                          {durationBadge(c)}
                        </span>
                        <span className="mt-1 block text-[10px] text-zinc-500">
                          {formatCreated(c.createdAt)}
                        </span>
                      </div>
                      <button
                        type="button"
                        title="Delete chat and approvals"
                        aria-label="Delete chat"
                        onClick={(e) => void handleDeleteChat(e, c.id)}
                        className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs font-medium text-zinc-400 transition hover:border-rose-500/40 hover:bg-rose-950/30 hover:text-rose-200"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        )}

        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {showEmptySplash ? (
            <div className="mx-auto flex max-w-xl flex-col items-center justify-center py-24 text-center">
              <p className="text-lg text-zinc-300">
                Click (+) New Chat to start generating your LinkedIn plan
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Or pick a saved chat from the list.
              </p>
            </div>
          ) : (
            <div className="w-full min-w-0 max-w-none md:mx-auto md:max-w-3xl">
              <h2 className="text-xl font-semibold text-white sm:text-2xl">Compose V2</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Generate a multi-week or multi-month plan. Each post is scheduled for approval;
                publish from here or from the Approvals tab.
              </p>

              <label className="mt-8 block text-sm font-medium text-zinc-300">
                Topic / Strategy
                {activeChat?.id ? (
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    (locked after this chat was created — use New Chat for a different topic)
                  </span>
                ) : null}
                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  readOnly={Boolean(activeChat?.id)}
                  rows={6}
                  className={`mt-2 w-full resize-y rounded-lg border border-white/10 px-3 py-3 text-sm leading-relaxed outline-none ring-[#0a66c2]/30 focus:ring-2 ${
                    activeChat?.id
                      ? "cursor-not-allowed text-zinc-400"
                      : "text-zinc-100"
                  }`}
                  style={{ minHeight: 160, backgroundColor: SURFACE }}
                  placeholder="Paste your topic, strategy document, campaign brief..."
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-6">
                <label className="text-sm text-zinc-300">
                  <span className="compose-duration-label mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                    Weeks
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={weeksInput}
                    onChange={(e) => {
                      setWeeksInput(e.target.value);
                      if (e.target.value) setMonthsInput("");
                    }}
                    className="compose-duration-input w-24 rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-[#0a66c2]/40"
                    placeholder="—"
                  />
                </label>
                <label className="text-sm text-zinc-300">
                  <span className="compose-duration-label mb-1 block text-xs uppercase tracking-wide text-zinc-500">
                    Months
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={monthsInput}
                    onChange={(e) => {
                      setMonthsInput(e.target.value);
                      if (e.target.value) setWeeksInput("");
                    }}
                    className="compose-duration-input w-24 rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm text-zinc-100 outline-none focus:ring-2 focus:ring-[#0a66c2]/40"
                    placeholder="—"
                  />
                </label>
              </div>
              <p className="compose-duration-hint mt-2 text-xs text-zinc-500">
                e.g. 8 weeks = 8 posts, one per week end | 3 months = 3 posts, one per month start
              </p>

              <button
                type="button"
                disabled={loading || (!activeChat?.id && !topic.trim())}
                onClick={() => void handleGenerate()}
                className="mt-4 rounded-lg px-5 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50"
                style={{ backgroundColor: ACCENT }}
              >
                {loading ? "Generating…" : "✦ Generate Plan"}
              </button>

              {loading && (
                <div
                  className="mt-10 flex flex-col items-center justify-center rounded-xl border border-white/10 p-10"
                  style={{ backgroundColor: SURFACE }}
                >
                  <div
                    className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-600 border-t-transparent"
                    style={{ borderTopColor: ACCENT }}
                    aria-hidden
                  />
                  <p className="mt-4 max-w-md text-center text-sm font-medium text-zinc-200">
                    Claude is writing your posts and Imagen 4 is generating images…
                  </p>
                  {generatePlanCount != null ? (
                    <p className="mt-2 max-w-md text-center text-xs leading-relaxed text-zinc-500">
                      Generating {generatePlanCount} posts + images — often ~{generatePlanCount * 8}{" "}
                      seconds total when <code className="text-zinc-400">GEMINI_API_KEY</code> is set.
                    </p>
                  ) : null}
                </div>
              )}

              {sortedPosts.length > 0 && !loading && (
                <section className="mt-10">
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <h3 className="text-base font-semibold text-white sm:text-lg">Your Plan</h3>
                      <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-zinc-400">
                        {sortedPosts.length} posts
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleGenerate()}
                        disabled={
                          loading || (!activeChat?.id && !topic.trim())
                        }
                        className="rounded-md border border-white/20 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-50"
                      >
                        Regenerate
                      </button>
                    </div>
                  </div>

                  <ul className="mt-6 space-y-3">
                    {sortedPosts.map((p) => {
                      const open = expanded.has(p.index);
                      const publishing = publishingIndex === p.index;
                      const due = isDueNow(p);
                      const labelUpper = p.label.toUpperCase();
                      return (
                        <li
                          key={p.index}
                          className="overflow-hidden rounded-xl border border-white/10 transition hover:border-white/20"
                          style={{ backgroundColor: SURFACE }}
                        >
                          <div className="flex flex-col gap-3 px-3 py-3 sm:px-4 sm:py-3">
                            <button
                              type="button"
                              onClick={() => togglePost(p.index)}
                              className="flex w-full min-w-0 items-start gap-2 text-left"
                            >
                              <span
                                className="shrink-0 rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white"
                                style={{ backgroundColor: ACCENT }}
                              >
                                {labelUpper}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="line-clamp-3 text-sm font-medium leading-snug text-zinc-100 sm:line-clamp-2 sm:text-base">
                                  {p.theme}
                                </p>
                                <p className="mt-1 text-xs text-zinc-500">
                                  Scheduled: {formatScheduled(p.scheduledDate)}
                                </p>
                              </div>
                              <span className="shrink-0 pt-0.5 text-zinc-500" aria-hidden>
                                {open ? "▼" : "▶"}
                              </span>
                            </button>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                              <div className="flex flex-wrap items-center gap-2">
                                {p.status === "published" && (
                                  <span className="rounded-md bg-[#0a66c2]/35 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-100">
                                    Published
                                  </span>
                                )}
                                {p.status === "rejected" && (
                                  <span className="rounded-md bg-zinc-600/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-300">
                                    Rejected
                                  </span>
                                )}
                                {p.status === "pending" && due && (
                                  <span className="rounded-md bg-[#0a66c2]/40 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-100">
                                    Due Now
                                  </span>
                                )}
                                {p.status === "pending" && !due && (
                                  <span className="rounded-md bg-zinc-700/50 px-2 py-0.5 text-[10px] font-semibold uppercase text-zinc-400">
                                    Pending
                                  </span>
                                )}
                              </div>
                              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
                                <button
                                  type="button"
                                  onClick={(e) => void copyPost(e, p.content, p.index)}
                                  className="min-h-[44px] rounded-md border border-white/15 px-4 text-sm font-medium text-zinc-200 hover:bg-white/5 sm:min-h-0 sm:px-3 sm:py-1.5 sm:text-xs"
                                >
                                  {copiedIndex === p.index ? "✓ Copied" : "Copy"}
                                </button>
                                <button
                                  type="button"
                                  disabled={publishing || p.status === "published"}
                                  onClick={(e) => void publishPost(e, p.content, p.index)}
                                  className={`min-h-[44px] w-full rounded-md border-none px-4 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:px-3.5 sm:py-1.5 sm:text-xs ${
                                    p.status === "published"
                                      ? "bg-[#1db954]"
                                      : "bg-[#0a66c2] hover:bg-[#1d8aff]"
                                  }`}
                                >
                                  {publishing
                                    ? "Publishing…"
                                    : p.status === "published"
                                      ? "✓ Published"
                                      : "Publish to LinkedIn"}
                                </button>
                              </div>
                            </div>
                          </div>
                          {open && (
                            <div
                              className="border-t border-white/10"
                              style={{ backgroundColor: "rgba(0,0,0,0.2)" }}
                            >
                              <PostImagesGallery
                                images={postImageList(p)}
                                canEdit={p.status === "pending"}
                                busy={
                                  postImageBusyKey !== null &&
                                  postImageBusyKey.startsWith(`${p.index}-`)
                                }
                                uploading={postImageBusyKey === `${p.index}-add`}
                                title="Post images (AI + uploads)"
                                enableImagePreview
                                onAddFile={(file) => void addPostImage(p.index, file)}
                                onRemove={(i) => void removePostImage(p.index, i)}
                              />
                              <div
                                className="px-3 py-4 font-sans text-[15px] leading-relaxed tracking-normal text-zinc-200 sm:px-4 sm:text-sm"
                                style={{ whiteSpace: "pre-wrap" }}
                              >
                                {p.content}
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </div>
          )}
        </main>
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

export default function ComposeV2PageWithSuspense() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center text-sm text-zinc-400"
          style={{ backgroundColor: BG }}
        >
          Loading…
        </div>
      }
    >
      <ComposeV2Page />
    </Suspense>
  );
}
