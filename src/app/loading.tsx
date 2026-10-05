export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center py-24" role="status" aria-label="Loading">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
    </div>
  );
}
