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
  if (active) {
    return "flex min-h-[44px] items-center gap-2 rounded-lg border-l-[3px] border-[#0a66c2] bg-[#0a66c2]/10 py-2.5 pl-[calc(0.75rem-3px)] pr-3 text-left text-sm font-medium text-[#0a5494] transition";
  }
  return "flex min-h-[44px] items-center gap-2 rounded-lg border-l-[3px] border-transparent py-2.5 pl-3 pr-3 text-left text-sm text-zinc-600 transition hover:bg-black/[0.04] hover:text-zinc-900";
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
    <aside
      className="flex h-full min-h-0 w-60 shrink-0 flex-col border-r px-4 py-6 lg:h-auto lg:min-h-screen"
      style={{
        backgroundColor: "var(--app-sidebar)",
        borderColor: "var(--app-border)",
      }}
    >
      {showClose ? (
        <div className="mb-4 flex flex-col gap-3">
          <div className="flex items-start justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 min-w-11 shrink-0 items-center justify-center rounded-lg border border-black/10 text-lg text-zinc-700 transition hover:border-[#0a66c2]/50 hover:bg-black/[0.04]"
              aria-label="Close menu"
            >
              ×
            </button>
          </div>
          <div className="min-w-0 px-2">
            <p
              className="text-xs font-medium uppercase tracking-[0.2em]"
              style={{ color: ACCENT_HOVER }}
            >
              LinkedIn
            </p>
            <h1 className="mt-1 truncate text-lg font-semibold text-zinc-900">
              Autopilot
            </h1>
          </div>
        </div>
      ) : (
        <div className="mb-6 flex flex-col gap-3 px-2">
          <p
            className="text-xs font-medium uppercase tracking-[0.2em]"
            style={{ color: ACCENT_HOVER }}
          >
            LinkedIn
          </p>
          <h1 className="text-lg font-semibold text-zinc-900">Autopilot</h1>
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
      <p className="mt-4 px-2 text-xs text-zinc-600">
        <code className="text-zinc-800"></code>
      </p>
    </aside>
  );
}
