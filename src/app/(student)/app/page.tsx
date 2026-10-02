"use client";

import { Flame, Info, Timer } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ErrorState } from "@/components/feedback/states";
import { SectionBlock, StatTile } from "@/components/layout/section-block";
import { CurrentMissionCard } from "@/features/dashboard/components/current-mission-card";
import { DailyLoop } from "@/features/dashboard/components/daily-loop";
import { AdaptiveNextCard } from "@/features/dashboard/components/adaptive-next-card";
import {
  useDailyPlan,
  useGreetingKey,
  useGoal,
  useStudent,
} from "@/features/journey/hooks/use-journey";
import { useT } from "@/lib/i18n/provider";
import { formatDuration, percent } from "@/lib/utils";


/**
 * Primary dashboard. Answers one question immediately:
 * "What should I do now?" — greeting, goal, phase, progress,
 * then the mission hero, then today's loop, then compact stats.
 */
export default function DashboardPage() {
  const t = useT();
  const greetingKey = useGreetingKey();
  const studentQuery = useStudent();
  const goalQuery = useGoal();
  const planQuery = useDailyPlan();

  const isLoading = studentQuery.isLoading || goalQuery.isLoading || planQuery.isLoading;
  const isError = studentQuery.isError || goalQuery.isError || planQuery.isError;

  if (isLoading) return <PageSkeleton blocks={2} />;
  if (isError || !studentQuery.data || !goalQuery.data || !planQuery.data) {
    return (
      <ErrorState
        title={t("state.error.title")}
        body={t("state.error.body")}
        onRetry={() => {
          void studentQuery.refetch();
          void goalQuery.refetch();
          void planQuery.refetch();
        }}
      />
    );
  }

  const student = studentQuery.data;
  const goal = goalQuery.data;
  const plan = planQuery.data;
  const mission = plan.mission;
  const currentPhase = mission.phaseTitle;

  return (
    <div className="flex flex-col gap-8">
      {/* Identity + goal context */}
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t(greetingKey)}, {student.fullName.split(" ")[0]}
          </h1>
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="micro-label">{t("dashboard.currentGoal")}</p>
            <p className="mt-1 truncate text-base font-semibold tracking-tight">{goal.title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("dashboard.phase")}: <span className="font-medium text-foreground">{currentPhase}</span>
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end gap-1.5">
              <span className="micro-label">{t("dashboard.progress")}</span>
              <span className="tabular text-2xl font-semibold">{goal.overallProgress}%</span>
            </div>
            <Progress
              value={goal.overallProgress}
              size="lg"
              className="hidden w-32 sm:block"
              label={t("dashboard.progress")}
            />
          </div>
        </div>
      </header>

      {/* Hero: the mission */}
      <CurrentMissionCard mission={mission} />
      {/* Adaptive decision — why this mission? */}
      <AdaptiveNextCard />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Today's journey loop */}
        <SectionBlock label={t("dashboard.todaysJourney")}>
          <div className="rounded-lg border border-border bg-surface p-5">
            <DailyLoop steps={plan.steps} />
          </div>

          {/* Why + what's after: reinforces the journey, answers "why am I doing this?" */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex gap-3 rounded-lg border border-border bg-surface p-4">
              <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">{t("dashboard.whyMission")}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t("dashboard.whyMissionBody")}
                </p>
              </div>
            </div>
            <div className="flex gap-3 rounded-lg border border-border bg-surface p-4">
              <Timer className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <p className="text-sm font-semibold">{t("dashboard.afterMission")}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t("dashboard.afterMissionBody")}
                </p>
              </div>
            </div>
          </div>
        </SectionBlock>

        {/* Compact progress — deliberately small; stats never outrank the mission */}
        <SectionBlock
          label={t("dashboard.compactProgress")}
          action={
            <Link
              href="/app/progress"
              className="text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("common.viewAll")}
            </Link>
          }
        >
          <div className="flex flex-col gap-3">
            <StatTile
              label={t("dashboard.focusMinutes")}
              value={`${plan.focusMinutesDone} / ${plan.focusMinutesPlanned}`}
              hint={formatDuration(plan.focusMinutesPlanned - plan.focusMinutesDone) + " planned left"}
            />
            <StatTile
              label={t("dashboard.streak")}
              value={`${plan.streakDays}`}
              hint={`${percent(plan.focusMinutesDone, plan.focusMinutesPlanned)}% of today's plan`}
            />
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
              <span className="flex size-9 items-center justify-center rounded-md border border-mastery/40 bg-mastery-subtle text-mastery">
                <Flame className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{t("dashboard.modulesMastered")}: 5</p>
                <Badge tone="mastery" className="mt-1">{t("progress.mastery")}</Badge>
              </div>
            </div>
          </div>
        </SectionBlock>
      </div>
    </div>
  );
}
