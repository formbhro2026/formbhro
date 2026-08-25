import { cn } from "@/lib/utils";

function Bar({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-white/[0.06]", className)} />;
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg p-4">
      <Bar className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Bar key={i} className="mt-3 h-3" />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-bg p-4">
          <Bar className="h-10 w-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1">
            <Bar className="h-3.5 w-1/2" />
            <Bar className="mt-2.5 h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MessagesSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={cn("flex", i % 2 ? "justify-end" : "justify-start")}>
          <Bar className={cn("h-12", i % 2 ? "w-1/2" : "w-2/3")} />
        </div>
      ))}
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="space-y-4">
      <Bar className="h-6 w-56" />
      <Bar className="h-36 rounded-2xl" />
      <Bar className="h-28 rounded-2xl" />
      <ListSkeleton rows={2} />
    </div>
  );
}

export function GridSkeleton({ items = 4 }: { items?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: items }).map((_, i) => (
        <Bar key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  );
}
