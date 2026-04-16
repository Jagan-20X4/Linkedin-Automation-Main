export default function ComposeV2Loading() {
  return (
    <div
      className="flex min-h-screen animate-pulse text-zinc-500"
      style={{ backgroundColor: "#0f0f0f" }}
    >
      <aside
        className="shrink-0 border-r border-white/10 px-3 py-6"
        style={{ width: 220, backgroundColor: "#1a1a1a" }}
      />
      <div
        className="shrink-0 border-r border-white/10 py-6 pl-4 pr-3"
        style={{ width: 280, backgroundColor: "#1a1a1a" }}
      >
        <div className="mb-4 h-4 w-16 rounded bg-white/10" />
        <div className="space-y-2">
          <div className="h-16 rounded-lg bg-white/5" />
          <div className="h-16 rounded-lg bg-white/5" />
        </div>
      </div>
      <main className="min-w-0 flex-1 px-8 py-8">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="h-8 w-48 rounded bg-white/10" />
          <div className="h-4 w-full max-w-md rounded bg-white/5" />
          <div className="h-40 w-full rounded-lg bg-white/5" />
        </div>
      </main>
    </div>
  );
}
