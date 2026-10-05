// Placeholder shown inside a section's layout while its page loads, so the
// header and tab bar stay put and the content area doesn't jump.
export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="animate-pulse" role="status" aria-label="Loading">
      <div className="h-6 w-40 rounded bg-slate-200" />
      <div className="mt-2 h-4 w-56 rounded bg-slate-100" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: cards }, (_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="h-4 w-1/2 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-1/3 rounded bg-slate-100" />
            <div className="mt-4 h-10 w-full rounded-lg bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
