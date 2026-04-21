"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const ACCENT_HOVER = "#1d8aff";

type NavId =
  | "dashboard"
  | "compose"
  | "queue"
  | "approvals"
  | "orm"
  | "settings";

type Item =
  | { kind: "home"; id: NavId; href: string; label: string; icon: string }
  | { kind: "route"; href: string; label: string; icon: string; path: string };

const ITEMS: Item[] = [
  { kind: "home", id: "dashboard", href: "/", label: "Dashboard", icon: "📊" },
  { kind: "home", id: "compose", href: "/?tab=compose", label: "Compose", icon: "✏️" },
  {
    kind: "route",
    href: "/compose-v2",
    label: "Compose V2",
    icon: "🚀",
    path: "/compose-v2",
  },
  { kind: "route", href: "/comments", label: "Comments", icon: "💬", path: "/comments" },
  { kind: "home", id: "queue", href: "/?tab=queue", label: "Queue", icon: "📅" },
  { kind: "home", id: "approvals", href: "/?tab=approvals", label: "Approvals", icon: "✅" },
  { kind: "home", id: "settings", href: "/?tab=settings", label: "Settings", icon: "⚙️" },
  { kind: "home", id: "orm", href: "/?tab=orm", label: "ORM Monitor", icon: "◎" },
];

function itemActive(pathname: string, searchParams: URLSearchParams, item: Item): boolean {
  if (item.kind === "route") {
    return pathname === item.path;
  }
  const tab = searchParams.get("tab");
  if (item.id === "dashboard") {
    return pathname === "/" && (!tab || tab === "");
  }
  return pathname === "/" && tab === item.id;
}

function itemClass(active: boolean) {
  return `flex min-h-[44px] items-center gap-2 rounded-lg py-2.5 pl-3 pr-3 text-left text-sm transition ${
    active
      ? "border-l-[3px] border-[#0a66c2] bg-[#0a66c2]/15 pl-[calc(0.75rem-3px)] font-medium text-white"
      : "border-l-[3px] border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
  }`;
}

export type DashboardSidebarProps = {
  /** Called after a nav link is activated (e.g. close mobile drawer). */
  onNavigate?: () => void;
  showClose?: boolean;
  onClose?: () => void;
};

export function DashboardSidebar({
  onNavigate,
  showClose,
  onClose,
}: DashboardSidebarProps = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <aside className="flex h-full min-h-0 w-60 shrink-0 flex-col border-r border-white/10 bg-[#0a0c10] px-4 py-6 lg:h-auto lg:min-h-screen">
      {showClose ? (
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="min-w-0 px-2">
            <p
              className="text-xs font-medium uppercase tracking-[0.2em]"
              style={{ color: ACCENT_HOVER }}
            >
              LinkedIn
            </p>
            <h1 className="mt-1 truncate text-lg font-semibold text-white">Autopilot</h1>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-white/15 text-lg text-zinc-300 transition hover:border-white/25 hover:bg-white/5"
            aria-label="Close menu"
          >
            ×
          </button>
        </div>
      ) : (
        <div className="mb-8 px-2">
          <p
            className="text-xs font-medium uppercase tracking-[0.2em]"
            style={{ color: ACCENT_HOVER }}
          >
            LinkedIn
          </p>
          <h1 className="mt-1 text-lg font-semibold text-white">Autopilot</h1>
        </div>
      )}
      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {ITEMS.map((item) => {
          const active = itemActive(pathname, searchParams, item);
          const cls = itemClass(active);
          return (
            <Link
              key={item.kind === "home" ? item.href + item.id : item.href}
              href={item.href}
              prefetch
              scroll={false}
              className={cls}
              onClick={() => onNavigate?.()}
            >
              <span className="text-base opacity-90" aria-hidden>
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-4 px-2 text-xs text-zinc-500">
        Configure keys in <code className="text-zinc-400">.env.local</code>
      </p>
    </aside>
  );
}
