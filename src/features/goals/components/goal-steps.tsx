"use client";

import { Check } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export type GoalStepId = "discover" | "refine" | "review" | "committed";

const STEPS: GoalStepId[] = ["discover", "refine", "review", "committed"];

export interface GoalStepsProps {
  current: GoalStepId;
}

/**
 * Calm wayfinding for the guided flow: where the student is, and what
 * comes next. Status only — no scores, no progress theatre (§26).
 */
export function GoalSteps({ current }: GoalStepsProps) {
  const t = useT();
  const currentIndex = STEPS.indexOf(current);

  return (
    <nav aria-label={t("goals.steps.label")}>
      <ol className="flex items-center gap-2 sm:gap-3">
        {STEPS.map((step, index) => {
          const done = index < currentIndex;
          const active = index === currentIndex;
          return (
            <li
              key={step}
              aria-current={active ? "step" : undefined}
              className="flex items-center gap-2 sm:gap-3"
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border text-2xs font-medium",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary text-primary",
                  !done && !active && "border-border text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {done ? <Check className="size-3" /> : index + 1}
              </span>
              <span
                className={cn(
                  "hidden text-xs sm:block",
                  active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {t(`goals.steps.${step}`)}
              </span>
              {index < STEPS.length - 1 && (
                <span className="h-px w-4 bg-border sm:w-6" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
