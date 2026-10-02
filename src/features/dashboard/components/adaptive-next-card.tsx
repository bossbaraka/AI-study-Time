"use client";

import { Lightbulb, ArrowRight } from "lucide-react";
import { useAdaptiveNext } from "@/features/intelligence/hooks/use-learning-intelligence";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function AdaptiveNextCard() {
  const { data, isLoading, isError } = useAdaptiveNext();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-5 animate-pulse">
        <div className="h-4 w-32 bg-muted rounded" />
        <div className="mt-3 h-3 w-full bg-muted rounded" />
      </div>
    );
  }

  if (isError || !data) return null;

  const primary = data.primary;

  return (
    <section aria-label="Next learning action" className="rounded-xl border border-primary/30 bg-primary/5 p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Lightbulb className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="micro-label text-primary">Next learning action</p>
          <h3 className="mt-1 text-sm font-semibold leading-snug">
            {primary.action} {primary.conceptId ? `• ${primary.conceptId}` : ""}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{primary.reason}</p>

          <details className="mt-3 group">
            <summary className="cursor-pointer text-xs font-medium text-primary underline-offset-4 hover:underline list-none flex items-center gap-1">
              Why am I seeing this? <ArrowRight className="size-3 transition-transform group-open:rotate-90" />
            </summary>
            <div className="mt-2 rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed text-muted-foreground">
              <p>{primary.reason}</p>
              {data.alternatives.length > 0 && (
                <ul className="mt-2 list-disc ps-4">
                  {data.alternatives.map((alt, i) => (
                    <li key={i}>{alt.action}: {alt.reason}</li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-2xs">Evaluated at {new Date(data.evaluatedAt).toLocaleString()}</p>
            </div>
          </details>

          <div className="mt-4 flex gap-2">
            <Link href="/app/mission">
              <Button size="sm">Continue</Button>
            </Link>
            <Link href="/app/mastery">
              <Button variant="secondary" size="sm">View mastery</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
