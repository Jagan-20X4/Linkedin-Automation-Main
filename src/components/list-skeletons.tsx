/** Shared shimmer bars — uses `.ui-skeleton-bar` from `globals.css`. */

function ShimmerBar({ className }: { className: string }) {
  return <div className={`ui-skeleton-bar ${className}`} aria-hidden />;
}

export function ApprovalsListSkeleton() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="rounded-xl border border-white/10 bg-[#11141b] p-4"
          aria-hidden
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <ShimmerBar className="h-[22px] w-20 rounded-md" />
            <ShimmerBar className="h-[22px] w-14 rounded-md" />
          </div>
          <ShimmerBar className="mt-3 h-3.5 w-[200px] max-w-[55%] rounded" />
          <ShimmerBar className="mt-2 h-4 w-[70%] max-w-full rounded" />
          <ShimmerBar className="mt-2 h-3 w-[150px] max-w-[45%] rounded" />
        </li>
      ))}
    </>
  );
}

export function ComposeV2ChatListSkeleton() {
  return (
    <ul className="space-y-2 pr-1" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="rounded-lg border border-white/10 px-2 py-2"
          style={{ backgroundColor: "rgba(0,0,0,0.2)" }}
        >
          <ShimmerBar className="h-4 w-[75%] max-w-full rounded" />
          <ShimmerBar className="mt-2 h-3 w-16 rounded-full" />
          <ShimmerBar className="mt-2 h-2.5 w-28 rounded" />
        </li>
      ))}
    </ul>
  );
}

export function CommentsPostsListSkeleton() {
  return (
    <ul aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <li
          key={i}
          className="border-b px-4 py-3.5"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-2">
            <ShimmerBar className="h-5 w-14 shrink-0 rounded" />
            <ShimmerBar className="h-3 flex-1 rounded" />
          </div>
          <ShimmerBar className="mt-2 h-3 w-[90%] rounded" />
          <ShimmerBar className="mt-1.5 h-3 w-24 rounded" />
        </li>
      ))}
    </ul>
  );
}
