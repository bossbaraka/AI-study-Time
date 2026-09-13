"use client";

import { Clock3, Info, TimerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/skeleton";
import { PlannedActualBarChart } from "@/components/charts/data-charts";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { SectionBlock, StatTile } from "@/components/layout/section-block";
import { useBehaviorProfile } from "@/features/intelligence/hooks/use-intelligence";
import { useT } from "@/lib/i18n/provider";
import { formatDuration } from "@/lib/utils";
import type { DelayRecord } from "@/types/domain";


/**
 * Behavior — delays and execution patterns presented as insight,
 * never punishment. Language: "observed pattern", "behavioral indicator".
 */
export default function BehaviorPage() {
  const t = useT();
  const behaviorQuery = useBehaviorProfile();

  if (behaviorQuery.isLoading) return <PageSkeleton blocks={3} />;
  if (behaviorQuery.isError || !behaviorQuery.data) {
    return (
      <ErrorState
        title={t("state.error.title")}
        body={t("state.error.body")}
        onRetry={() => void behaviorQuery.refetch()}
      />
    );
  }

  const behavior = behaviorQuery.data;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("behavior.title")} subtitle={t("behavior.subtitle")} />

      {/* Behavioral patterns */}
      <SectionBlock label={t("behavior.patterns")}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label={t("behavior.bestTime")} value={behavior.bestStudyWindow} />
          <StatTile
            label={t("behavior.avgSession")}
            value={formatDuration(behavior.averageSessionMinutes)}
          />
          <StatTile label={t("behavior.recoverySuccess")} value={`${behavior.recoverySuccessRate}%`} />
          <StatTile label={t("behavior.completionConsistency")} value={`${behavior.completionConsistency}%`} />
        </div>

        {/* Observed delay pattern — an insight, stated neutrally */}
        <div className="mt-3 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-subtle p-4">
          <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <p className="micro-label !text-warning-foreground">{t("profile.observed")}</p>
            <p className="mt-1 text-sm font-medium text-warning-foreground">
              «{behavior.delayPatternInsight}»
            </p>
            <p className="mt-1 text-xs text-warning-foreground/80">{t("delay.notPunishment")}</p>
          </div>
        </div>
      </SectionBlock>

      {/* Weekly focus: planned vs actual */}
      <SectionBlock label={t("behavior.weeklyFocus")}>
        <div
          className="rounded-lg border border-border bg-surface p-4 sm:p-5"
          role="img"
          aria-label={t("behavior.weeklyFocus")}
        >
          <PlannedActualBarChart
            data={behavior.weeklyFocusMinutes.map((d) => ({
              label: d.day,
              actual: d.minutes,
              planned: d.planned,
            }))}
          />
        </div>
      </SectionBlock>

      {/* Recent delays */}
      <SectionBlock label={t("behavior.delays")}>
        {behavior.recentDelays.length === 0 ? (
          <EmptyState
            icon={Clock3}
            title={t("behavior.empty")}
            body={t("delay.notPunishment")}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {behavior.recentDelays.map((record) => (
              <DelayCard key={record.id} record={record} />
            ))}
          </ul>
        )}
      </SectionBlock>

      <p className="rounded-lg border border-border bg-surface p-4 text-xs leading-relaxed text-muted-foreground">
        {t("behavior.disclaimer")}
      </p>
    </div>
  );
}

/**
 * Delay card — "DELAY RECORDED", expected vs actual, duration,
 * detected pattern and suggested recovery. Factual tone throughout.
 */
function DelayCard({ record }: { record: DelayRecord }) {
  const t = useT();
  const expected = new Date(record.expectedAt);
  const actual = new Date(record.actualAt);
  const fmt = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone="warning">
          <TimerOff className="size-3" aria-hidden="true" />
          {t("delay.recorded")}
        </Badge>
        <span className="tabular text-xs text-muted-foreground">
          +{formatDuration(record.delayMinutes)}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold">{record.taskTitle}</p>
      <p className="mt-1 text-xs text-muted-foreground">{t("delay.notice")}</p>
      <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-xs">
        <div>
          <dt className="text-muted-foreground">{t("delay.expected")}</dt>
          <dd className="tabular mt-1 font-medium">{fmt.format(expected)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("delay.actual")}</dt>
          <dd className="tabular mt-1 font-medium">{fmt.format(actual)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("delay.duration")}</dt>
          <dd className="tabular mt-1 font-medium text-warning-foreground">
            {formatDuration(record.delayMinutes)}
          </dd>
        </div>
      </dl>
      <p className="mt-4 rounded-md border border-border bg-background px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground">{t("delay.pattern")}: </span>
        {t("delay.insightExample")}{" "}
        <span className="font-semibold text-foreground">{t("delay.suggestion")}: </span>
        {t("tests.recommendation.review-then-continue")}.
      </p>
    </li>
  );
}
