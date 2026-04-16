export default function CommentsLoading() {
  return (
    <div
      className="flex min-h-screen animate-pulse text-zinc-500"
      style={{ backgroundColor: "#0f0f0f" }}
    >
      <aside
        className="shrink-0 border-r border-white/10 px-3 py-6"
        style={{ width: 220, backgroundColor: "#1a1a1a" }}
      >
        <div className="mb-8 h-10 w-32 rounded bg-white/10" />
        <div className="space-y-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-white/5" />
          ))}
        </div>
      </aside>
      <div className="min-h-0 flex-1 p-6 md:p-8">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="h-8 w-56 rounded bg-white/10" />
          <div className="h-64 w-full rounded-xl border border-white/5 bg-white/5" />
        </div>
      </div>
    </div>
  );
}
