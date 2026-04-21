"use client";

import { useSearchParams } from "next/navigation";
import { ApprovalPostEditor } from "@/components/approval-post-editor";
import { PostImagesGallery } from "@/components/post-images-gallery";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";

type NavId =
  | "dashboard"
  | "compose"
  | "queue"
  | "approvals"
  | "orm"
  | "settings";

const TAB_IDS = new Set<NavId>([
  "dashboard",
  "compose",
  "queue",
  "approvals",
  "orm",
  "settings",
]);

type ApprovalTiming = "due" | "upcoming" | "published" | "rejected";

type ScheduledApprovalRow = {
  id: string;
  chatId: string;
  chatTitle: string;
  /** From API: chats.json + disambiguation when titles collide. */
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

function approvalImageList(a: ScheduledApprovalRow): string[] {
  if (Array.isArray(a.images) && a.images.length > 0) return a.images;
  if (a.imageUrl?.trim()) return [a.imageUrl.trim()];
  return [];
}

function resolveApprovalTiming(a: ScheduledApprovalRow): ApprovalTiming {
  if (a.timing) return a.timing;
  if (a.status === "published") return "published";
  if (a.status === "rejected") return "rejected";
  if (a.isDue) return "due";
  return "upcoming";
}

function upcomingCountdownLabel(daysUntil: number) {
  if (daysUntil === 0) return "Due today";
  if (daysUntil === 1) return "Tomorrow";
  if (daysUntil < 7) return `In ${daysUntil} days`;
  if (daysUntil < 30) return `In ${Math.ceil(daysUntil / 7)} weeks`;
  return `In ${Math.ceil(daysUntil / 30)} months`;
}

const ACCENT_HOVER = "#1d8aff";

function HomePage() {
  const searchParams = useSearchParams();
  const [active, setActive] = useState<NavId>("dashboard");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (!tab || tab === "") {
      setActive("dashboard");
      return;
    }
    if (TAB_IDS.has(tab as NavId)) {
      setActive(tab as NavId);
    }
  }, [searchParams]);
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");
  const [generated, setGenerated] = useState("");
  const [composeImageUrl, setComposeImageUrl] = useState<string | null>(null);
  const [composeImagePrompt, setComposeImagePrompt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [linkedinMessage, setLinkedinMessage] = useState<string | null>(null);
  const [ormUrn, setOrmUrn] = useState("");
  const [ormResult, setOrmResult] = useState<string | null>(null);
  const [localPublishDone, setLocalPublishDone] = useState(false);

  const [approvals, setApprovals] = useState<ScheduledApprovalRow[]>([]);
  const [approvalsFilter, setApprovalsFilter] = useState<
    "all" | "due" | "upcoming" | "published" | "rejected"
  >("all");
  const [approvalActionId, setApprovalActionId] = useState<string | null>(null);
  const [approvalBusy, setApprovalBusy] = useState<
    Record<string, { dirty: boolean; saving: boolean }>
  >({});
  const [approvalsToast, setApprovalsToast] = useState<string | null>(null);
  const [approvalImageBusyId, setApprovalImageBusyId] = useState<string | null>(
    null,
  );
  /** When set, Approvals list only shows rows for this chat id. */
  const [approvalsChatIdFilter, setApprovalsChatIdFilter] = useState<string | null>(
    null,
  );

  const queueCount = 12;

  const publishDisabled = useMemo(() => {
    const hasPost = Boolean(generated.trim());
    return loading || !hasPost || localPublishDone;
  }, [loading, generated, localPublishDone]);

  const loadScheduledApprovals = useCallback(async () => {
    try {
      const res = await fetch("/api/approvals");
      const data = (await res.json()) as {
        success?: boolean;
        approvals?: ScheduledApprovalRow[];
      };
      if (data.approvals) setApprovals(data.approvals);
    } catch {
      /* ignore */
    }
  }, []);

  const handleApprovalBusy = useCallback(
    (id: string, s: { dirty: boolean; saving: boolean }) => {
      setApprovalBusy((prev) => {
        const next = { ...prev };
        if (!s.dirty && !s.saving) delete next[id];
        else next[id] = s;
        return next;
      });
    },
    [],
  );

  useEffect(() => {
    if (active !== "approvals") return;
    void loadScheduledApprovals();
    const id = setInterval(() => void loadScheduledApprovals(), 60000);
    return () => clearInterval(id);
  }, [active, loadScheduledApprovals]);

  const stats = useMemo(
    () => [
      { label: "Impressions", value: "24.8k", delta: "+12%" },
      { label: "Engagement", value: "4.2%", delta: "+0.4%" },
      { label: "Queue", value: String(queueCount), delta: "scheduled" },
      { label: "Followers", value: "3,420", delta: "+28" },
    ],
    [],
  );

  async function handleGenerate() {
    setLoading(true);
    setGenerated("");
    setComposeImageUrl(null);
    setComposeImagePrompt(null);
    setLinkedinMessage(null);
    setLocalPublishDone(false);
    try {
      const res = await fetch("/api/generate-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim() || undefined,
          tone: tone.trim() || undefined,
          audience: audience.trim() || undefined,
        }),
      });
      const ct = res.headers.get("content-type") ?? "";
      const data = ct.includes("application/json")
        ? await res.json()
        : { error: `Non-JSON response (${res.status})` };
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "Generation failed",
        );
      }
      setGenerated(typeof data.post === "string" ? data.post : "");
      setComposeImageUrl(
        typeof data.imageUrl === "string" && data.imageUrl ? data.imageUrl : null,
      );
      setComposeImagePrompt(
        typeof data.imagePrompt === "string" && data.imagePrompt
          ? data.imagePrompt
          : null,
      );
    } catch (e) {
      setGenerated(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function handlePublishLinkedIn() {
    if (!generated.trim()) return;
    setLoading(true);
    setLinkedinMessage(null);
    try {
      const res = await fetch("/api/linkedin/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: generated }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data.error === "string" ? data.error : "LinkedIn publish failed",
        );
      }
      setLinkedinMessage("Posted to LinkedIn successfully.");
      setLocalPublishDone(true);
    } catch (e) {
      setLinkedinMessage(e instanceof Error ? e.message : "LinkedIn error");
    } finally {
      setLoading(false);
    }
  }

  const dueCount = useMemo(
    () => approvals.filter((a) => resolveApprovalTiming(a) === "due").length,
    [approvals],
  );

  type ApprovalsChatSummary = {
    chatId: string;
    chatTitle: string;
    total: number;
    due: number;
    upcoming: number;
    published: number;
    rejected: number;
  };

  const approvalsByChat = useMemo((): ApprovalsChatSummary[] => {
    const map = new Map<string, ApprovalsChatSummary>();
    for (const a of approvals) {
      const chatId = a.chatId;
      const chatTitle =
        (a.displayChatTitle ?? a.chatTitle)?.trim() || "(untitled)";
      let row = map.get(chatId);
      if (!row) {
        row = {
          chatId,
          chatTitle,
          total: 0,
          due: 0,
          upcoming: 0,
          published: 0,
          rejected: 0,
        };
        map.set(chatId, row);
      }
      row.chatTitle = chatTitle;
      row.total += 1;
      const t = resolveApprovalTiming(a);
      if (t === "due") row.due += 1;
      else if (t === "upcoming") row.upcoming += 1;
      else if (t === "published") row.published += 1;
      else row.rejected += 1;
    }
    return [...map.values()].sort((x, y) => y.total - x.total);
  }, [approvals]);

  const filteredApprovals = useMemo(() => {
    return approvals.filter((a) => {
      if (approvalsChatIdFilter !== null && a.chatId !== approvalsChatIdFilter) {
        return false;
      }
      const t = resolveApprovalTiming(a);
      if (approvalsFilter === "all") return true;
      if (approvalsFilter === "due") return t === "due";
      if (approvalsFilter === "upcoming") return t === "upcoming";
      if (approvalsFilter === "published") return t === "published";
      return t === "rejected";
    });
  }, [approvals, approvalsFilter, approvalsChatIdFilter]);

  async function approveScheduled(id: string) {
    setApprovalActionId(id);
    try {
      const res = await fetch(
        `/api/approvals/${encodeURIComponent(id)}/approve`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed");
      }
      setApprovalsToast("Published to LinkedIn!");
      await loadScheduledApprovals();
    } catch (e) {
      setApprovalsToast(e instanceof Error ? e.message : "Failed");
    } finally {
      setApprovalActionId(null);
    }
  }

  async function rejectScheduled(id: string) {
    if (!confirm("Reject this post?")) return;
    try {
      const res = await fetch(
        `/api/approvals/${encodeURIComponent(id)}/reject`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Failed");
      }
      setApprovalsToast("Post rejected.");
      await loadScheduledApprovals();
    } catch (e) {
      setApprovalsToast(e instanceof Error ? e.message : "Failed");
    }
  }

  async function addApprovalImage(approvalId: string, file: File) {
    setApprovalImageBusyId(approvalId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/approvals/${encodeURIComponent(approvalId)}/images`,
        { method: "POST", body: fd },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Upload failed");
      }
      await loadScheduledApprovals();
    } catch (e) {
      setApprovalsToast(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setApprovalImageBusyId(null);
    }
  }

  async function removeApprovalImage(approvalId: string, imageIndex: number) {
    setApprovalImageBusyId(approvalId);
    try {
      const res = await fetch(
        `/api/approvals/${encodeURIComponent(approvalId)}/images/${imageIndex}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Remove failed");
      }
      await loadScheduledApprovals();
    } catch (e) {
      setApprovalsToast(e instanceof Error ? e.message : "Remove failed");
    } finally {
      setApprovalImageBusyId(null);
    }
  }

  useEffect(() => {
    if (!approvalsToast) return;
    const t = setTimeout(() => setApprovalsToast(null), 4000);
    return () => clearTimeout(t);
  }, [approvalsToast]);

  async function fetchComments() {
    if (!ormUrn.trim()) return;
    setLoading(true);
    setOrmResult(null);
    try {
      const params = new URLSearchParams({ urn: ormUrn.trim() });
      const res = await fetch(`/api/orm/comments?${params}`);
      const data = await res.json();
      setOrmResult(JSON.stringify(data, null, 2));
    } catch (e) {
      setOrmResult(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        {active === "dashboard" && (
          <div className="mx-auto max-w-5xl">
            <header className="mb-8">
              <h2 className="text-xl font-semibold text-white sm:text-2xl">Dashboard</h2>
              <p className="mt-1 text-sm text-zinc-400">
                Overview of reach, engagement, and pipeline.
              </p>
            </header>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border border-white/10 bg-[#11141b] p-5 shadow-sm shadow-black/40"
                >
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                    {s.label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tabular-nums text-white">
                    {s.value}
                  </p>
                  <p className="mt-2 text-xs text-[#7cc4ff]/90">{s.delta}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {active === "compose" && (
          <div className="mx-auto max-w-2xl">
            <h2 className="text-xl font-semibold text-white sm:text-2xl">Compose</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Generate a post with Claude (optional image with Imagen 4 when{" "}
              <code className="text-zinc-500">GEMINI_API_KEY</code> is set), then
              publish to LinkedIn. For multi-week plans and scheduled approvals,
              use Compose V2.
            </p>
            <label className="mt-6 block text-sm text-zinc-300">
              Topic / angle
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#11141b] px-3 py-2 text-sm text-zinc-100 outline-none ring-[#0a66c2]/35 focus:ring-2"
                placeholder="e.g. Lessons from shipping our Q1 roadmap"
              />
            </label>
            <label className="mt-4 block text-sm text-zinc-300">
              Tone (optional)
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#11141b] px-3 py-2 text-sm text-zinc-100 outline-none ring-[#0a66c2]/35 focus:ring-2"
                placeholder="e.g. warm, concise"
              />
            </label>
            <label className="mt-4 block text-sm text-zinc-300">
              Audience (optional)
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#11141b] px-3 py-2 text-sm text-zinc-100 outline-none ring-[#0a66c2]/35 focus:ring-2"
                placeholder="e.g. hiring managers in healthcare"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={handleGenerate}
                className="rounded-lg bg-[#0a66c2] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d8aff] disabled:opacity-50"
              >
                {loading ? "Generating post + image…" : "Generate post"}
              </button>
              <button
                type="button"
                disabled={publishDisabled}
                onClick={handlePublishLinkedIn}
                className="rounded-lg border border-[#0a66c2]/40 bg-[#0a66c2]/12 px-4 py-2 text-sm font-medium text-blue-100 hover:bg-[#0a66c2]/20 disabled:opacity-50"
              >
                Publish to LinkedIn now
              </button>
            </div>
            {linkedinMessage && (
              <p className="mt-3 text-sm text-zinc-300">{linkedinMessage}</p>
            )}
            {generated && (
              <div className="mt-6 rounded-xl border border-white/10 bg-[#11141b] p-4">
                <p className="text-xs font-medium uppercase text-zinc-500">
                  Draft
                </p>
                {composeImageUrl ? (
                  <div className="mt-3 border-b border-white/10 pb-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      AI-generated image (Imagen 4)
                    </p>
                    <img
                      src={composeImageUrl}
                      alt=""
                      className="mt-2 max-h-80 max-w-full rounded-lg border border-white/10 object-contain"
                    />
                    {composeImagePrompt ? (
                      <p className="mt-2 text-xs text-zinc-500 line-clamp-2">
                        Prompt: {composeImagePrompt}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-200">
                  {generated}
                </pre>
              </div>
            )}
          </div>
        )}

        {active === "queue" && (
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-semibold text-white sm:text-2xl">Queue</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Scheduled posts will appear here once connected to your posting
              pipeline.
            </p>
            <ul className="mt-6 space-y-3">
              {["Mon 9:00 — Product update", "Wed 14:00 — Team spotlight"].map(
                (line) => (
                  <li
                    key={line}
                    className="rounded-lg border border-white/10 bg-[#11141b] px-4 py-3 text-sm text-zinc-300"
                  >
                    {line}
                  </li>
                ),
              )}
            </ul>
          </div>
        )}

        {active === "approvals" && (
          <div className="mx-auto max-w-3xl min-w-0">
            <h2 className="text-xl font-semibold text-white sm:text-2xl">Approvals</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Scheduled posts from Compose V2. Approve to publish directly to
              LinkedIn, or reject to skip. This list refreshes every minute while
              you stay on this tab.
            </p>
            {approvalsByChat.length > 0 && (
              <div className="mt-4 rounded-lg border border-white/10 bg-[#11141b]/80 px-3 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  By chat
                </p>
                <div className="mt-2 flex max-w-full flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setApprovalsChatIdFilter(null)}
                    className={`max-w-full rounded-full border px-3 py-1.5 text-left text-xs transition ${
                      approvalsChatIdFilter === null
                        ? "border-[#0a66c2]/50 bg-[#0a66c2]/15 text-blue-100"
                        : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                    }`}
                  >
                    All chats
                    <span className="ml-1 tabular-nums text-zinc-500">
                      ({approvals.length})
                    </span>
                  </button>
                  {approvalsByChat.map((s) => {
                    const parts: string[] = [];
                    if (s.due > 0) parts.push(`${s.due} due`);
                    if (s.upcoming > 0) parts.push(`${s.upcoming} upcoming`);
                    if (s.published > 0) parts.push(`${s.published} published`);
                    if (s.rejected > 0) parts.push(`${s.rejected} rejected`);
                    const detail = parts.length > 0 ? parts.join(" · ") : `${s.total} total`;
                    const active = approvalsChatIdFilter === s.chatId;
                    return (
                      <button
                        key={s.chatId}
                        type="button"
                        onClick={() => setApprovalsChatIdFilter(s.chatId)}
                        title={detail}
                        className={`max-w-full rounded-full border px-3 py-1.5 text-left text-xs transition sm:max-w-[min(100%,18rem)] ${
                          active
                            ? "border-[#0a66c2]/50 bg-[#0a66c2]/15 text-blue-100"
                            : "border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
                        }`}
                      >
                        <span className="font-medium text-zinc-200">&ldquo;{s.chatTitle}&rdquo;</span>
                        <span className="mt-0.5 block truncate text-[11px] text-zinc-500">
                          {s.total} approvals — {detail}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {approvalsToast && (
              <p
                className={`mt-3 text-sm ${
                  approvalsToast.startsWith("Published") ||
                  approvalsToast.startsWith("Post rejected")
                    ? "text-sky-300/90"
                    : "text-rose-300/90"
                }`}
              >
                {approvalsToast}
              </p>
            )}
            <div className="mt-6 flex flex-wrap gap-2 border-b border-white/10 pb-3">
              {(
                [
                  ["all", "All"],
                  ["due", "Due Now"],
                  ["upcoming", "Upcoming"],
                  ["published", "Published"],
                  ["rejected", "Rejected"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setApprovalsFilter(id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    approvalsFilter === id
                      ? "bg-[#0a66c2] text-white"
                      : "bg-white/5 text-zinc-400 hover:bg-white/10"
                  }`}
                >
                  {label}
                  {id === "due" && dueCount > 0 ? (
                    <span className="ml-1.5 inline-block min-w-[1.25rem] rounded-full bg-rose-600 px-1 text-center text-[10px] text-white">
                      {dueCount}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            <ul className="mt-6 space-y-4">
              {filteredApprovals.length === 0 ? (
                <li className="rounded-lg border border-white/10 bg-[#11141b] px-4 py-6 text-center text-sm text-zinc-500">
                  No items in this view.
                </li>
              ) : (
                filteredApprovals.map((a) => {
                  const t = resolveApprovalTiming(a);
                  const daysUntil = typeof a.daysUntil === "number" ? a.daysUntil : 0;
                  const borderClass =
                    t === "published"
                      ? "border-[#0a66c2]/50"
                      : t === "rejected"
                        ? "border-zinc-600/40"
                        : t === "due"
                          ? "border-rose-500/55"
                          : "border-white/10";
                  const mutedCard = t === "upcoming" ? " opacity-60 hover:opacity-80" : "";
                  const badge =
                    t === "published"
                      ? { text: "Published", className: "bg-[#0a66c2]/30 text-blue-100" }
                      : t === "rejected"
                        ? { text: "Rejected", className: "bg-zinc-600/40 text-zinc-400" }
                        : t === "due"
                          ? { text: "DUE NOW", className: "bg-rose-600/40 text-rose-100" }
                          : {
                              text: upcomingCountdownLabel(daysUntil),
                              className: "bg-white/[0.08] text-zinc-400",
                            };
                  let schedLabel: string;
                  try {
                    schedLabel = new Date(a.scheduledDate).toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                  } catch {
                    schedLabel = a.scheduledDate;
                  }
                  const busy = approvalBusy[a.id];
                  const approveBlocked = Boolean(
                    busy?.dirty || busy?.saving || approvalImageBusyId === a.id,
                  );
                  return (
                    <li
                      key={a.id}
                      className={`rounded-xl border bg-[#11141b] p-4 transition-opacity ${borderClass}${mutedCard}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.className}`}
                        >
                          {badge.text}
                        </span>
                        <span className="text-xs font-medium uppercase text-zinc-500">
                          {a.label}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-zinc-500">
                        Topic:{" "}
                        <span className="text-zinc-200">
                          &ldquo;
                          {a.displayChatTitle ?? a.chatTitle}
                          &rdquo;
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-zinc-300">
                        <span className="text-zinc-500">Theme:</span> {a.theme}
                      </p>
                      <p className="mt-2 text-xs text-zinc-500">
                        Scheduled: {schedLabel}
                      </p>
                      {t === "published" && a.publishedAt && (
                        <p className="mt-1 text-xs text-[#7cc4ff]/90">
                          Published{" "}
                          {new Date(a.publishedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      )}
                      <details className="mt-3 rounded-lg border border-white/10 bg-black/20">
                        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-400">
                          {a.status === "pending" ? "Preview & edit post" : "Preview post"}
                        </summary>
                        <ApprovalPostEditor
                          approvalId={a.id}
                          serverContent={a.content}
                          canEdit={a.status === "pending"}
                          onBusyChange={handleApprovalBusy}
                          onSaved={loadScheduledApprovals}
                        />
                        <PostImagesGallery
                          images={approvalImageList(a)}
                          canEdit={a.status === "pending"}
                          busy={approvalImageBusyId === a.id}
                          title="Post images (synced with Compose)"
                          onAddFile={(f) => void addApprovalImage(a.id, f)}
                          onRemove={(i) => void removeApprovalImage(a.id, i)}
                        />
                      </details>
                      {t === "due" && (
                        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                          {approveBlocked ? (
                            <span className="mr-auto text-xs text-amber-200/80">
                              {[
                                busy?.dirty || busy?.saving
                                  ? "Save the post (or discard edits) to enable publish."
                                  : null,
                                approvalImageBusyId === a.id
                                  ? "Finish image upload or removal first."
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" ")}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void rejectScheduled(a.id)}
                            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-200 hover:bg-white/5"
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            title={
                              approveBlocked
                                ? "Save changes before publishing"
                                : undefined
                            }
                            disabled={approvalActionId === a.id || approveBlocked}
                            onClick={() => void approveScheduled(a.id)}
                            className="rounded-lg bg-[#0a66c2] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d8aff] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {approvalActionId === a.id
                              ? "Publishing…"
                              : "Approve & Publish"}
                          </button>
                        </div>
                      )}
                      {t === "upcoming" && (
                        <p className="mt-4 text-right text-xs text-zinc-500">
                          Scheduled for {schedLabel}
                        </p>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}

        {active === "orm" && (
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-semibold text-white sm:text-2xl">ORM Monitor</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Fetch comments for a LinkedIn activity or UGC URN (requires API
              access).
            </p>
            <label className="mt-6 block text-sm text-zinc-300">
              URN
              <input
                value={ormUrn}
                onChange={(e) => setOrmUrn(e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#11141b] px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-[#0a66c2]/35 focus:ring-2"
                placeholder="urn:li:activity:..."
              />
            </label>
            <button
              type="button"
              disabled={loading}
              onClick={fetchComments}
              className="mt-4 rounded-lg bg-[#0a66c2] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d8aff] disabled:opacity-50"
            >
              {loading ? "Loading…" : "Fetch comments"}
            </button>
            {ormResult && (
              <pre className="mt-4 max-h-96 overflow-auto rounded-xl border border-white/10 bg-[#11141b] p-4 text-xs text-zinc-300">
                {ormResult}
              </pre>
            )}
          </div>
        )}

        {active === "settings" && (
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-semibold text-white sm:text-2xl">Settings</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Add real credentials to <code className="text-zinc-300">.env.local</code>:
            </p>
            <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-zinc-400">
              <li>
                ANTHROPIC_API_KEY — Claude for compose; optional{" "}
                <code className="text-zinc-500">ANTHROPIC_MODEL</code> (default{" "}
                <code className="text-zinc-500">claude-sonnet-4-6</code>)
              </li>
              <li>
                GEMINI_API_KEY — Google AI key for Imagen 4 images on Compose and
                Compose V2 (optional; omit to skip images)
              </li>
              <li>
                LINKEDIN_ACCESS_TOKEN — member token with w_member_social (+ profile
                scopes)
              </li>
            </ul>
          </div>
        )}
    </main>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0c10] text-sm text-zinc-400">
          Loading…
        </div>
      }
    >
      <HomePage />
    </Suspense>
  );
}
