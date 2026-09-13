"use client";

import { PageSkeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ProgressRing } from "@/components/charts/progress-ring";
import { PlannedActualBarChart, TrendAreaChart } from "@/components/charts/data-charts";
import { ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { SectionBlock, StatTile } from "@/components/layout/section-block";
import { StatusBadge } from "@/components/feedback/status-indicator";
import { useGoal, useRoadmap } from "@/features/journey/hooks/use-journey";
import { useBehaviorProfile } from "@/features/intelligence/hooks/use-intelligence";
import { useT } from "@/lib/i18n/provider";


const PROGRESS_TREND = [
  { label: "W1", value: 12 },
  { label: "W2", value: 21 },
  { label: "W3", value: 29 },
  { label: "W4", value: 38 },
  { label: "W5", value: 44 },
  { label: "W6", value: 53 },
  { label: "W7", value: 61 },
  { label: "W8", value: 68 },
];

/**
 * Progress — framed as movement toward the goal.
 * No points, no leaderboards, no streak-shaming.
 */
export default function ProgressPage() {
  const t = useT();
  const goalQuery = useGoal();
  const roadmapQuery = useRoadmap();
  const behaviorQuery = useBehaviorProfile();

  if (goalQuery.isLoading || roadmapQuery.isLoading) return <PageSkeleton blocks={3} />;
  if (goalQuery.isError || roadmapQuery.isError || !goalQuery.data || !roadmapQuery.data) {
    return (
      <ErrorState
        title={t("state.error.title")}
        body={t("state.error.body")}
        onRetry={() => {
          void goalQuery.refetch();
          void roadmapQuery.refetch();
        }}
      />
    );
  }

  const goal = goalQuery.data;
  const roadmap = roadmapQuery.data;
  const behavior = behaviorQuery.data;
  const masteredPhases = roadmap.phases.filter((p) => p.status === "mastered").length;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("progress.title")} subtitle={t("progress.subtitle")} />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <SectionBlock label={t("progress.overall")}>
          <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface p-6">
            <ProgressRing value={goal.overallProgress} size={150} label={t("progress.overall")}>
              <span className="tabular text-3xl font-semibold">{goal.overallProgress}%</span>
            </ProgressRing>
            <p className="text-center text-sm font-medium">{goal.title}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatTile label={t("progress.mastery")} value={`${masteredPhases} / ${roadmap.phases.length}`} hint={t("roadmap.title")} />
            <StatTile
              label={t("behavior.completionConsistency")}
              value={behavior ? `${behavior.completionConsistency}%` : "—"}
            />
          </div>
        </SectionBlock>

        <div className="flex flex-col gap-6">
          <SectionBlock label={t("insights.progressTrend")}>
            <div className="rounded-lg border border-border bg-surface p-4 sm:p-5" role="img" aria-label={t("insights.progressTrend")}>
              <TrendAreaChart data={PROGRESS_TREND} />
            </div>
          </SectionBlock>

          {behavior && (
            <SectionBlock label={t("progress.weeklyFocus")}>
              <div className="rounded-lg border border-border bg-surface p-4 sm:p-5" role="img" aria-label={t("progress.weeklyFocus")}>
                <PlannedActualBarChart
                  data={behavior.weeklyFocusMinutes.map((d) => ({
                    label: d.day,
                    actual: d.minutes,
                    planned: d.planned,
                  }))}
                />
              </div>
            </SectionBlock>
          )}
        </div>
      </div>

      <SectionBlock label={t("progress.phaseBreakdown")}>
        <ul className="flex flex-col gap-3">
          {roadmap.phases.map((phase) => (
            <li key={phase.id} className="rounded-lg border border-border bg-surface p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold">{phase.title}</h3>
                  <StatusBadge status={phase.status} />
                </div>
                <span className="tabular text-sm font-semibold">{phase.progress}%</span>
              </div>
              <Progress
                value={phase.progress}
                className="mt-3"
                tone={phase.status === "mastered" ? "mastery" : phase.status === "current" ? "primary" : "muted"}
                label={phase.title}
              />
            </li>
          ))}
        </ul>
      </SectionBlock>
    </div>
  );
}
