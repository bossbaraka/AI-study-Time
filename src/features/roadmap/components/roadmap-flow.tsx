"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ErrorState } from "@/components/feedback/states";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useExecutionView } from "@/features/execution/hooks/use-execution";
import { GoalSummary } from "@/features/goals/components/goal-summary";
import { useActiveDiscoveryGoal } from "@/features/goals/hooks/use-goal-discovery";
import { MilestoneCard } from "@/features/roadmap/components/milestone-card";
import { RoadmapGenerate } from "@/features/roadmap/components/roadmap-generate";
import { RoadmapOverview } from "@/features/roadmap/components/roadmap-overview";
import { useActiveRoadmap, useGenerateRoadmap } from "@/features/roadmap/hooks/use-roadmap";
import { normalizeRoadmapError } from "@/features/roadmap/lib/errors";
import { currentMilestone } from "@/features/roadmap/lib/current-milestone";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { RoadmapExecutionView } from "@/types/execution";
import type { Roadmap } from "@/types/roadmap";

/**
 * /roadmap orchestrator (§21–§23):
 *   no locked goal      → redirect /goals (never generate without one)
 *   locked, no roadmap  → explicit generation screen
 *   roadmap             → goal summary → overview → milestone timeline
 * The current milestone is derived from domain state, never local state.
 */
export function RoadmapFlow() {
  const t = useT();
  const router = useRouter();
  const goalQuery = useActiveDiscoveryGoal();
  const roadmapQuery = useActiveRoadmap();
  const generate = useGenerateRoadmap();
  // Phase 7 runtime overlay — additive; the roadmap view never waits on it.
  const executionQuery = useExecutionView();

  const goal = goalQuery.data ?? null;
  const roadmap = roadmapQuery.data ?? null;
  const executionView = executionQuery.data ?? null;
  const hasLockedGoal = goal?.status === "locked";

  // A roadmap without a locked goal is impossible by contract — send the
  // student to the goal flow instead (replace, so Back never loops here).
  useEffect(() => {
    if (goalQuery.isPending) return;
    if (!goal || goal.status !== "locked") router.replace("/goals");
  }, [goalQuery.isPending, goal, router]);

  const handleGenerate = () => {
    if (goal) generate.mutate(goal.id);
  };

  if (goalQuery.isPending || (!hasLockedGoal && !goalQuery.isError)) {
    return <PageSkeleton blocks={2} />;
  }

  if (goalQuery.isError) {
    return (
      <ErrorState
        title={t("roadmap.loadError.title")}
        body={t("roadmap.errors.generic")}
        onRetry={() => void goalQuery.refetch()}
      />
    );
  }

  // Redirect in flight (goal missing or not locked) — keep the skeleton.
  if (!goal || !hasLockedGoal) return <PageSkeleton blocks={2} />;

  if (roadmapQuery.isPending) {
    return <PageSkeleton blocks={2} />;
  }

  if (roadmapQuery.isError) {
    const error = normalizeRoadmapError(roadmapQuery.error);
    return (
      <ErrorState
        title={t("roadmap.loadError.title")}
        body={t(error.messageKey)}
        onRetry={error.retryable ? () => void roadmapQuery.refetch() : undefined}
      />
    );
  }

  if (!roadmap) {
    return (
      <RoadmapGenerate
        goal={goal}
        onGenerate={handleGenerate}
        isGenerating={generate.isPending}
        error={generate.isError ? normalizeRoadmapError(generate.error) : null}
        onRetry={handleGenerate}
      />
    );
  }

  return (
    <RoadmapView
      roadmap={roadmap}
      goalSummary={<GoalSummary goal={goal} />}
      executionView={executionView}
    />
  );
}

function RoadmapView({
  roadmap,
  goalSummary,
  executionView,
}: {
  roadmap: Roadmap;
  goalSummary: ReactNode;
  executionView: RoadmapExecutionView | null;
}) {
  const t = useT();
  const current = currentMilestone(roadmap);
  const ordered = [...roadmap.milestones].sort((a, b) => a.order - b.order);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key="roadmap"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex flex-col gap-8"
      >
        <header>
          <p className="micro-label">{t("roadmap.view.kicker")}</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            {roadmap.title}
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("roadmap.view.version", { version: roadmap.version })}
          </p>
        </header>

        {executionView?.currentUnit && (
          <ContinueCard view={executionView} />
        )}
        {executionView?.allUnitsPassed && !executionView.currentUnit && (
          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            {t("roadmap.view.allUnitsDone")}
          </p>
        )}

        <section aria-label={t("roadmap.view.goalLabel")} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-tight">
            {t("roadmap.view.goalLabel")}
          </h2>
          <Card>
            <CardContent className="p-5">{goalSummary}</CardContent>
          </Card>
        </section>

        <section aria-label={t("roadmap.view.overviewLabel")} className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold tracking-tight">
            {t("roadmap.view.overviewLabel")}
          </h2>
          <RoadmapOverview roadmap={roadmap} />
        </section>

        <section aria-label={t("roadmap.view.timelineLabel")} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold tracking-tight">
              {t("roadmap.view.timelineLabel")}
            </h2>
            {current && (
              <p className="text-xs text-muted-foreground">
                {t("roadmap.view.currentHint", { name: current.title })}
              </p>
            )}
          </div>
          <ol className="flex flex-col gap-3">
            {ordered.map((milestone) => (
              <MilestoneCard
                key={milestone.id}
                milestone={milestone}
                roadmap={roadmap}
                unitStates={executionView?.unitStates}
              />
            ))}
          </ol>
        </section>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * The Phase 7 entry point: the ONE current unit, derived from execution
 * runtime state (§12/§21). Replaces the old "execution arrives later"
 * placeholder — honestly, because execution now exists.
 */
function ContinueCard({ view }: { view: RoadmapExecutionView }) {
  const t = useT();
  const unit = view.currentUnit;
  if (!unit) return null;
  const freshStart = view.unitStates[unit.id] === "available";
  return (
    <section aria-label={t("roadmap.view.continueLabel")}>
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="micro-label">{t("roadmap.view.continueKicker")}</p>
            <p className="text-sm font-semibold tracking-tight text-foreground">{unit.title}</p>
            <p className="text-xs text-muted-foreground">
              {t("roadmap.view.continueMilestone", { name: unit.milestoneTitle })}
            </p>
          </div>
          <Link
            href={`/roadmap/learn/${unit.id}`}
            className={cn(buttonVariants({ variant: "primary" }), "self-start")}
          >
            {freshStart ? t("roadmap.view.startCta") : t("roadmap.view.resumeCta")}
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}
