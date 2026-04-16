import { Suspense } from "react";
import { DashboardSidebar } from "@/components/dashboard-sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-[#0a0c10] text-zinc-100">
      <Suspense
        fallback={
          <aside
            className="w-60 shrink-0 animate-pulse border-r border-white/10 bg-[#0a0c10]"
            aria-hidden
          />
        }
      >
        <DashboardSidebar />
      </Suspense>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
