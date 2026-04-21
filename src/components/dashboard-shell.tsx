"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

function SidebarFallback() {
  return (
    <aside
      className="hidden w-60 shrink-0 animate-pulse border-r border-white/10 bg-[#0a0c10] lg:block"
      aria-hidden
    />
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  return (
    <div className="flex min-h-screen min-h-[100dvh] bg-[#0a0c10] text-zinc-100">
      {/* Desktop sidebar */}
      <Suspense fallback={<SidebarFallback />}>
        <div className="hidden shrink-0 lg:block">
          <DashboardSidebar />
        </div>
      </Suspense>

      {/* Mobile drawer overlay */}
      {drawerOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-[1px] lg:hidden"
          onClick={closeDrawer}
        />
      ) : null}

      {/* Mobile drawer panel */}
      {drawerOpen ? (
        <div className="fixed inset-y-0 left-0 z-50 w-[min(18rem,88vw)] shadow-2xl shadow-black/50 lg:hidden">
          <Suspense
            fallback={
              <aside className="flex h-full w-full animate-pulse flex-col border-r border-white/10 bg-[#0a0c10] px-4 py-6" />
            }
          >
            <DashboardSidebar onNavigate={closeDrawer} showClose onClose={closeDrawer} />
          </Suspense>
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#0a0c10]/95 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-11 min-w-11 items-center justify-center rounded-lg border border-white/15 text-zinc-200 transition hover:border-[#0a66c2]/50 hover:bg-white/5"
            aria-expanded={drawerOpen}
            aria-controls="dashboard-mobile-nav"
            aria-label="Open menu"
          >
            <span className="text-lg leading-none" aria-hidden>
              ☰
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-[#1d8aff]">LinkedIn</p>
            <p className="truncate text-base font-semibold text-white">Autopilot</p>
          </div>
        </header>

        <div
          id="dashboard-mobile-nav"
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
