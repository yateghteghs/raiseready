/** Placeholder shown while a signed-in page loads its data. */
export function PageSkeleton() {
  return (
    <div role="status" aria-live="polite" className="grid animate-pulse gap-8">
      <span className="sr-only">Loading…</span>
      <div className="grid gap-3">
        <div className="bg-muted h-7 w-56 rounded" />
        <div className="bg-muted h-4 w-full max-w-lg rounded" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="bg-muted h-28 rounded-xl" />
        <div className="bg-muted h-28 rounded-xl" />
        <div className="bg-muted h-28 rounded-xl" />
      </div>
      <div className="bg-muted h-48 rounded-xl" />
    </div>
  );
}
