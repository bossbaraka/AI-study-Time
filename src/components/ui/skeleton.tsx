import { cn } from "@/lib/utils";

/** Base skeleton surface. Compose into feature-specific skeleton layouts. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse-soft rounded-md bg-muted", className)}
    />
  );
}

/** Standard page-level loading skeleton: header block + content blocks. */
export function PageSkeleton({ blocks = 2 }: { blocks?: number }) {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      {Array.from({ length: blocks }, (_, i) => (
        <Skeleton key={i} className="h-40 w-full" />
      ))}
    </div>
  );
}
