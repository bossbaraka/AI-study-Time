"use client";

import { Loader2, Map as MapIcon, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GoalSummary } from "@/features/goals/components/goal-summary";
import type { NormalizedRoadmapError } from "@/features/roadmap/lib/errors";
import { useT } from "@/lib/i18n/provider";
import type { LearningGoal } from "@/types/goal";

export interface RoadmapGenerateProps {
  goal: LearningGoal;
  onGenerate: () => void;
  isGenerating: boolean;
  error: NormalizedRoadmapError | null;
  onRetry: () => void;
}

/**
 * The generation screen: the locked goal restated (where you are going),
 * an honest description of what generation does, and one explicit action.
 * Generation is idempotent — clicking repeatedly never duplicates (§19).
 */
export function RoadmapGenerate({
  goal,
  onGenerate,
  isGenerating,
  error,
  onRetry,
}: RoadmapGenerateProps) {
  const t = useT();

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="micro-label flex items-center gap-1.5">
          <MapIcon className="size-3.5" aria-hidden="true" />
          {t("roadmap.generate.kicker")}
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("roadmap.generate.title")}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {t("roadmap.generate.body")}
        </p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-2 p-5">
          <p className="text-xs font-medium text-muted-foreground">
            {t("roadmap.generate.goalLabel")}
          </p>
          <GoalSummary goal={goal} />
        </CardContent>
      </Card>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-md border border-danger/40 bg-danger/5 px-4 py-3"
        >
          <p className="flex-1 text-sm text-danger-foreground">{t(error.messageKey)}</p>
          {error.retryable && (
            <Button variant="secondary" size="sm" onClick={onRetry} disabled={isGenerating}>
              <RotateCw className="size-4" aria-hidden="true" />
              {t("common.retry")}
            </Button>
          )}
        </div>
      )}

      <div>
        <Button size="lg" onClick={onGenerate} disabled={isGenerating}>
          {isGenerating && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isGenerating ? t("roadmap.generate.generating") : t("roadmap.generate.cta")}
        </Button>
        {isGenerating && (
          <p role="status" className="mt-2 text-xs text-muted-foreground">
            {t("roadmap.generate.progress")}
          </p>
        )}
      </div>
    </div>
  );
}
