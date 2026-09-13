"use client";

import { Progress } from "@/components/ui/progress";
import { useT } from "@/lib/i18n/provider";
import type { AssessmentProgress as AssessmentProgressModel } from "@/types/assessment";

export interface AssessmentProgressProps {
  progress: AssessmentProgressModel;
}

/**
 * Honest adaptive progress (§13): no "question 17 of 30". The engine
 * reports what it actually knows — questions explored and an estimated
 * remaining time — and the bar is explicitly labelled approximate.
 */
export function AssessmentProgressBar({ progress }: AssessmentProgressProps) {
  const t = useT();

  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="tabular">
          {t("assessment.questionsExplored", { count: progress.questionsAnswered })}
        </span>
        {progress.estimatedMinutesRemaining > 0 && (
          <span className="tabular">
            {t("assessment.etaRemaining", { minutes: progress.estimatedMinutesRemaining })}
          </span>
        )}
      </div>
      <Progress
        value={progress.estimatedCompletionPercent}
        size="sm"
        label={t("assessment.progressLabel")}
      />
    </div>
  );
}
