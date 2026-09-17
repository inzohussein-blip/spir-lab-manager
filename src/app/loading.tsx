import { Skeleton } from "@/components/ui/primitives";

export default function Loading() {
  return (
    <div>
      <Skeleton className="mb-6 h-8 w-56" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="my-3 h-4 w-full" />
        ))}
      </div>
    </div>
  );
}
