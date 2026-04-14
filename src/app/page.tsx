"use client";

import {
  registerTelegramWebhookAction,
  syncTelegramWebhookFromNgrokAction,
} from "@/app/actions/telegram-webhook";
import { useEffect, useMemo, useState } from "react";

type ApprovalUi = "idle" | "pending" | "approved" | "rejected" | "not_found";

type NavId =
  | "dashboard"
  | "compose"
  | "queue"
  | "approvals"
  | "orm"
  | "settings";

const NAV: { id: NavId; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "compose", label: "Compose" },
  { id: "queue", label: "Queue" },
  { id: "approvals", label: "Approvals" },
  { id: "orm", label: "ORM Monitor" },
  { id: "settings", label: "Settings" },
];

export default function Home() {
  const [active, setActive] = useState<NavId>("dashboard");
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");
  const [generated, setGenerated] = useState("");
  const [loading, setLoading] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [setupMessage, setSetupMessage] = useState<string | null>(null);
  const [linkedinMessage, setLinkedinMessage] = useState<string | null>(null);
  const [ormUrn, setOrmUrn] = useState("");
  const [ormResult, setOrmResult] = useState<string | null>(null);
  const [approvalDraftId, setApprovalDraftId] = useState<string | null>(null);
  const [approvalUi, setApprovalUi] = useState<ApprovalUi>("idle");
  const [approvalLinkedInPosted, setApprovalLinkedInPosted] = useState(false);
  const [localPublishDone, setLocalPublishDone] = useState(false);
  const [composeNotice, setComposeNotice] = useState<string | null>(null);

  const queueCount = 12;

  const publishDisabled = useMemo(() => {
    const hasPost = Boolean(generated.trim());
    /** Publish only after Telegram Approve for this draft; stay off after reject / not_found / already posted. */
    const blockedByApproval =
      hasPost &&
      (approvalUi !== "approved" ||
        (approvalUi === "approved" &&
          (approvalLinkedInPosted || localPublishDone)));
    return loading || !hasPost || blockedByApproval;
  }, [loading, generated, approvalUi, approvalLinkedInPosted, localPublishDone]);

  useEffect(() => {
    if (!approvalDraftId || approvalUi !== "pending") return;
    const draftIdForPoll = approvalDraftId;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(
          `/api/approval/status?draftId=${encodeURIComponent(draftIdForPoll)}`,
        );
        if (cancelled) return;
        if (res.status === 404) {
          setApprovalUi("not_found");
          return;
        }
        if (!res.ok) return;
        const data = (await res.json()) as {
          status?: string;
          linkedinPosted?: boolean;
        };
        if (data.status === "approved" || data.status === "rejected") {
          setApprovalUi(data.status);
          setApprovalLinkedInPosted(Boolean(data.linkedinPosted));
        }
      } catch {
        /* ignore transient poll errors */
      }
    }

    void poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [approvalDraftId, approvalUi]);

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
    setLinkedinMessage(null);
    setComposeNotice(null);
    setApprovalDraftId(null);
    setApprovalUi("idle");
    setApprovalLinkedInPosted(false);
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
    } catch (e) {
      setGenerated(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function handlePublishLinkedIn() {
    if (!generated.trim()) return;
    if (approvalUi !== "approved") return;
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
      if (approvalDraftId) setLocalPublishDone(true);
    } catch (e) {
      setLinkedinMessage(e instanceof Error ? e.message : "LinkedIn error");
    } finally {
      setLoading(false);
    }
  }

  async function registerTelegramWebhook() {
    setSetupMessage(null);
    if (!webhookUrl.trim()) {
      setSetupMessage("Enter webhook URL.");
      return;
    }
    setLoading(true);
    try {
      const result = await registerTelegramWebhookAction(webhookUrl.trim());
      if (!result.ok) {
        throw new Error(result.error);
      }
      setWebhookUrl(result.webhookUrl);
      setSetupMessage("Telegram webhook registered.");
    } catch (e) {
      setSetupMessage(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function syncWebhookFromNgrok() {
    setSetupMessage(null);
    setLoading(true);
    try {
      const result = await syncTelegramWebhookFromNgrokAction();
      if (!result.ok) {
        throw new Error(result.error);
      }
      setWebhookUrl(result.webhookUrl);
      setSetupMessage("Telegram webhook synced from ngrok.");
    } catch (e) {
      setSetupMessage(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendApproval() {
    if (!generated) return;
    setLoading(true);
    setComposeNotice(null);
    try {
      const res = await fetch("/api/approval/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: generated }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed");
      const id = typeof data.draftId === "string" ? data.draftId : "";
      if (!id) throw new Error("Missing draft id");
      setApprovalDraftId(id);
      setApprovalUi("pending");
      setApprovalLinkedInPosted(false);
      setLocalPublishDone(false);
      setComposeNotice(
        `Sent to Telegram. Draft ${id.slice(0, 8)}… — pending approval.`,
      );
    } catch (e) {
      setComposeNotice(e instanceof Error ? e.message : "Send failed");
    } finally {
      setLoading(false);
    }
  }

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
    <div className="flex min-h-screen bg-[#0a0c10] text-zinc-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-white/10 bg-[#0a0c10] px-4 py-6">
        <div className="mb-8 px-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-400/90">
            LinkedIn
          </p>
          <h1 className="mt-1 text-lg font-semibold text-white">Autopilot</h1>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item.id)}
              className={`rounded-lg px-3 py-2.5 text-left text-sm transition ${
                active === item.id
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <p className="mt-auto px-2 text-xs text-zinc-500">
          Configure keys in <code className="text-zinc-400">.env.local</code>
        </p>
      </aside>

      <main className="flex-1 overflow-auto px-8 py-8">
        {active === "dashboard" && (
          <div className="mx-auto max-w-5xl">
            <header className="mb-8">
              <h2 className="text-2xl font-semibold text-white">Dashboard</h2>
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
                  <p className="mt-2 text-xs text-emerald-400/90">{s.delta}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {active === "compose" && (
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl font-semibold text-white">Compose</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Generate a post with Claude, then send it for Telegram approval.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Flow: Generate → Send to Telegram (Pending) → Approve in Telegram
              (Approved) → Publish to LinkedIn unlocks. Publish stays disabled
              until Approved. Set LINKEDIN_POST_ON_APPROVE=true in env to post
              from Telegram on approve instead.
            </p>
            <label className="mt-6 block text-sm text-zinc-300">
              Topic / angle
              <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#11141b] px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/30 focus:ring-2"
                placeholder="e.g. Lessons from shipping our Q1 roadmap"
              />
            </label>
            <label className="mt-4 block text-sm text-zinc-300">
              Tone (optional)
              <input
                type="text"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#11141b] px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/30 focus:ring-2"
                placeholder="e.g. warm, concise"
              />
            </label>
            <label className="mt-4 block text-sm text-zinc-300">
              Audience (optional)
              <input
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#11141b] px-3 py-2 text-sm text-zinc-100 outline-none ring-emerald-500/30 focus:ring-2"
                placeholder="e.g. hiring managers in healthcare"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={handleGenerate}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                {loading ? "Working…" : "Generate post"}
              </button>
              <button
                type="button"
                disabled={loading || !generated}
                onClick={handleSendApproval}
                className="rounded-lg border border-white/15 bg-transparent px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-50"
              >
                Send to Telegram
              </button>
              <button
                type="button"
                disabled={publishDisabled}
                title={
                  publishDisabled && generated.trim() && approvalUi !== "approved"
                    ? "Approve this draft in Telegram first"
                    : undefined
                }
                onClick={handlePublishLinkedIn}
                className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-4 py-2 text-sm font-medium text-emerald-100 hover:bg-emerald-950/60 disabled:opacity-50"
              >
                Publish to LinkedIn now
              </button>
            </div>
            {generated.trim() && (
              <div
                className={`mt-4 rounded-xl border p-4 text-sm ${
                  approvalUi === "pending"
                    ? "border-amber-500/35 bg-amber-950/25 text-amber-100/95"
                    : approvalUi === "approved"
                      ? "border-emerald-500/35 bg-emerald-950/25 text-emerald-100/95"
                      : approvalUi === "rejected"
                        ? "border-rose-500/35 bg-rose-950/25 text-rose-100/95"
                        : "border-white/15 bg-[#11141b] text-zinc-300"
                }`}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Approval
                </p>
                <p className="mt-2 font-medium text-white">
                  {approvalUi === "idle" && "Not sent to Telegram"}
                  {approvalUi === "pending" && "Pending"}
                  {approvalUi === "approved" && "Approved"}
                  {approvalUi === "rejected" && "Rejected"}
                  {approvalUi === "not_found" && "Draft not found"}
                </p>
                {approvalUi === "idle" && (
                  <p className="mt-2 text-xs text-zinc-400">
                    Tap Send to Telegram, then Approve in the chat. Publish stays
                    disabled until Approved.
                  </p>
                )}
                {approvalDraftId && (
                  <p className="mt-1 font-mono text-xs text-zinc-500">
                    {approvalDraftId}
                  </p>
                )}
                {approvalUi === "pending" && (
                  <p className="mt-2 text-xs text-zinc-400">
                    Waiting for Approve or Reject in Telegram…
                  </p>
                )}
                {approvalUi === "approved" && approvalLinkedInPosted && (
                  <p className="mt-2 text-xs text-zinc-400">
                    LinkedIn was already posted from Telegram (auto-post enabled).
                  </p>
                )}
                {approvalUi === "approved" &&
                  !approvalLinkedInPosted &&
                  !localPublishDone && (
                    <p className="mt-2 text-xs text-zinc-400">
                      You can publish with Publish to LinkedIn now.
                    </p>
                  )}
                {approvalUi === "approved" && localPublishDone && (
                  <p className="mt-2 text-xs text-zinc-400">
                    Published from this app.
                  </p>
                )}
                {approvalUi === "not_found" && (
                  <p className="mt-2 text-xs text-zinc-400">
                    The server no longer has this draft (e.g. dev server
                    restarted). Generate again and send to Telegram.
                  </p>
                )}
              </div>
            )}
            {composeNotice && (
              <p className="mt-3 text-sm text-zinc-300">{composeNotice}</p>
            )}
            {linkedinMessage && (
              <p className="mt-3 text-sm text-zinc-300">{linkedinMessage}</p>
            )}
            {generated && (
              <div className="mt-6 rounded-xl border border-white/10 bg-[#11141b] p-4">
                <p className="text-xs font-medium uppercase text-zinc-500">
                  Draft
                </p>
                <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-200">
                  {generated}
                </pre>
              </div>
            )}
          </div>
        )}

        {active === "queue" && (
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-semibold text-white">Queue</h2>
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
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-semibold text-white">Approvals</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Approve or reject in Telegram. The bot replies in the chat with
              Approved or Rejected. By default, LinkedIn is published from the
              Compose tab after approval; set{" "}
              <code className="text-zinc-500">LINKEDIN_POST_ON_APPROVE=true</code>{" "}
              to post to LinkedIn immediately when you tap Approve.
            </p>
            <p className="mt-3 text-sm text-zinc-500">
              Telegram needs a public{" "}
              <strong className="text-zinc-300">https</strong> URL. Run ngrok on
              this PC (e.g. <code className="text-zinc-400">ngrok http 3000</code>
              ), then <strong className="text-zinc-300">Sync from ngrok</strong>{" "}
              — the server reads the tunnel from ngrok and registers the webhook
              (uses <code className="text-zinc-400">TELEGRAM_BOT_TOKEN</code> from
              env; no secret typed here). Or paste the full URL and use Register
              (manual). Requires <code className="text-zinc-400">npm run dev</code>{" "}
              and ngrok on the same machine.
            </p>
            <label className="mt-6 block text-sm text-zinc-300">
              Webhook URL (must be https, end with{" "}
              <code className="text-emerald-400/90">/api/approval/webhook</code>)
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#11141b] px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/30 focus:ring-2"
                placeholder="https://your-subdomain.ngrok-free.app/api/approval/webhook"
              />
            </label>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={syncWebhookFromNgrok}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Sync webhook from ngrok
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={registerTelegramWebhook}
                className="rounded-lg border border-white/15 bg-transparent px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-white/5 disabled:opacity-50"
              >
                Register (manual URL)
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              CLI (uses <code className="text-zinc-400">TELEGRAM_WEBHOOK_SETUP_SECRET</code>{" "}
              from <code className="text-zinc-400">.env</code>):{" "}
              <code className="text-zinc-400">npm run webhook:sync</code>
            </p>
            {setupMessage && (
              <p className="mt-3 text-sm text-zinc-300">{setupMessage}</p>
            )}
          </div>
        )}

        {active === "orm" && (
          <div className="mx-auto max-w-3xl">
            <h2 className="text-2xl font-semibold text-white">ORM Monitor</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Fetch comments for a LinkedIn activity or UGC URN (requires API
              access).
            </p>
            <label className="mt-6 block text-sm text-zinc-300">
              URN
              <input
                value={ormUrn}
                onChange={(e) => setOrmUrn(e.target.value)}
                className="mt-2 w-full rounded-lg border border-white/10 bg-[#11141b] px-3 py-2 font-mono text-sm text-zinc-100 outline-none ring-emerald-500/30 focus:ring-2"
                placeholder="urn:li:activity:..."
              />
            </label>
            <button
              type="button"
              disabled={loading}
              onClick={fetchComments}
              className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
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
            <h2 className="text-2xl font-semibold text-white">Settings</h2>
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
                LINKEDIN_ACCESS_TOKEN — member token with w_member_social (+ profile
                scopes)
              </li>
              <li>
                <code className="text-zinc-500">TELEGRAM_BOT_TOKEN</code> /{" "}
                <code className="text-zinc-500">TELEGRAM_CHAT_ID</code> — bot + chat;
                Next loads these as <code className="text-zinc-500">process.env</code>{" "}
                on the server for sends, webhooks, and Approvals server actions
              </li>
              <li>
                <code className="text-zinc-500">TELEGRAM_WEBHOOK_SETUP_SECRET</code>{" "}
                — only for <code className="text-zinc-500">npm run webhook:sync</code>{" "}
                and <code className="text-zinc-500">/api/telegram/webhook-setup</code>{" "}
                / <code className="text-zinc-500">webhook-sync</code> (header{" "}
                <code className="text-zinc-500">x-telegram-setup-secret</code>); not
                used by the Approvals buttons
              </li>
              <li>
                LINKEDIN_POST_ON_APPROVE — set to{" "}
                <code className="text-zinc-500">true</code> to post to LinkedIn
                when you tap Approve in Telegram; omit or leave unset to publish
                from Compose only
              </li>
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
