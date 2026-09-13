"use client";

import { CheckCircle2, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { UnitLearningContext } from "@/types/execution";

export interface UnitResultProps {
  context: UnitLearningContext;
  /** True while the retry (reopen) mutation is in flight. */
  isRetrying: boolean;
  /** Reopens the unit for another attempt (needs_review / failed only). */
  onRetry: () => void;
}

const RESULT_ICONS = {
  passed: CheckCircle2,
  needs_review: RefreshCw,
  failed: TriangleAlert,
} as const;

/**
 * The honest result panel (§10/§13/§22):
 * - passed       → the next eligible unit opens (or an honest "all units
 *                  passed" note — roadmap completion is NOT decided here)
 * - needs_review → the unit stays the current focus; retry is explicit
 * - failed       → supportive, never shameful; retry is explicit
 * No confidence scores, no mastery percentages, no fake AI claims.
 */
export function UnitResult({ context, isRetrying, onRetry }: UnitResultProps) {
  const t = useT();
  const result = context.execution?.result;
  if (!result) return null;

  const Icon = RESULT_ICONS[result];

  return (
    <section
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col gap-4 rounded-lg border p-5",
        result === "passed" && "border-success/35 bg-success-subtle/50",
        result === "needs_review" && "border-warning/35 bg-warning-subtle/50",
        result === "failed" && "border-danger/35 bg-danger-subtle/50",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full border bg-surface",
            result === "passed" && "border-success/40 text-success-foreground",
            result === "needs_review" && "border-warning/40 text-warning-foreground",
            result === "failed" && "border-danger/40 text-danger-foreground",
          )}
        >
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {t(`execution.result.${result}.title`)}
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(`execution.result.${result}.body`)}
          </p>
        </div>
      </div>

      {result === "passed" &&
        (context.nextUnit ? (
          <div className="flex flex-col gap-2 border-t border-border/60 pt-4">
            <p className="text-xs font-medium text-muted-foreground">
              {t("execution.result.nextLabel")}
            </p>
            <Link
              href={`/roadmap/learn/${context.nextUnit.id}`}
              className={cn(buttonVariants({ variant: "primary" }), "self-start")}
            >
              {t("execution.result.passed.nextCta", { name: context.nextUnit.title })}
            </Link>
          </div>
        ) : (
          <p className="border-t border-border/60 pt-4 text-sm leading-relaxed text-muted-foreground">
            {t("execution.result.passed.allDone")}
          </p>
        ))}

      {result !== "passed" && (
        <Button
          type="button"
          variant="secondary"
          onClick={onRetry}
          disabled={isRetrying}
          className="self-start"
        >
          {isRetrying && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isRetrying ? t("execution.result.tryingAgain") : t("execution.result.tryAgain")}
        </Button>
      )}
    </section>
  );
}
