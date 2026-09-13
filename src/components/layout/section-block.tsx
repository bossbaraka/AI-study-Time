import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Section block — the standard content grouping across app screens.
 * A quiet micro-label + content; replaces decorative section headers.
 */
export function SectionBlock({
  label,
  action,
  children,
  className,
}: {
  label?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)} aria-label={label}>
      {(label || action) && (
        <div className="flex items-center justify-between gap-3">
          {label && <h2 className="micro-label">{label}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** Compact statistic tile used on the dashboard and progress screens. */
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-xl font-semibold tracking-tight">{value}</p>
      {hint && <p className="mt-0.5 text-2xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
