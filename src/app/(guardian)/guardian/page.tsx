"use client";

import { Eye, HandHeart, Info, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { SectionBlock, StatTile } from "@/components/layout/section-block";
import { useGuardianSummary } from "@/features/engagement/hooks/use-engagement";
import { useT } from "@/lib/i18n/provider";
import { cn, formatDate } from "@/lib/utils";


/**
 * Guardian view — calm oversight, not surveillance.
 * Progress + wellbeing signals + concrete support suggestions.
 * Private mentor conversations are never exposed (product rule).
 */
export default function GuardianPage() {
  const t = useT();
  const summaryQuery = useGuardianSummary();

  if (summaryQuery.isLoading) return <PageSkeleton blocks={3} />;
  if (summaryQuery.isError || !summaryQuery.data) {
    return (
      <ErrorState
        title={t("state.error.title")}
        body={t("state.error.body")}
        onRetry={() => void summaryQuery.refetch()}
      />
    );
  }

  const s = summaryQuery.data;
  const weeklyHours = Math.round(s.weeklyFocusMinutes / 60);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 lg:px-8">
      <PageHeader
        title={t("guardian.title")}
        subtitle={t("guardian.subtitle")}
        actions={
          <Badge tone="info">
            <ShieldCheck className="size-3" aria-hidden="true" />
            {t("guardian.student")}: {s.studentName}
          </Badge>
        }
      />

      <section className="rounded-xl border border-border bg-surface p-6">
        <p className="micro-label">{t("dashboard.currentGoal")}</p>
        <h2 className="mt-1.5 text-xl font-semibold tracking-tight">{s.goalTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("dashboard.phase")}: <span className="font-medium text-foreground">{s.currentPhase}</span>
        </p>
        <div className="mt-5 flex items-center gap-4">
          <Progress value={s.overallProgress} className="flex-1" label={t("goal.progress")} />
          <span className="tabular text-lg font-semibold">{s.overallProgress}%</span>
        </div>
      </section>

      <SectionBlock>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatTile
            label={t("progress.weeklyFocus")}
            value={`${weeklyHours}h`}
            hint={`${t("goal.commitmentValue", { hours: s.weeklyCommitmentHours })}`}
          />
          <StatTile label={t("behavior.completionConsistency")} value={`${s.consistency}%`} />
          <StatTile label={t("behavior.recoverySuccess")} value="84%" />
        </div>
      </SectionBlock>

      <div className="grid gap-6 md:grid-cols-2">
        <SectionBlock label={t("guardian.highlight")}>
          <ul className="flex flex-col gap-3">
            {s.recentHighlights.map((highlight) => (
              <li key={highlight.date} className="flex gap-3 rounded-lg border border-border bg-surface p-4">
                <Eye className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                <div>
                  <p className="text-sm leading-relaxed">{highlight.text}</p>
                  <p className="tabular mt-1 text-2xs text-muted-foreground">{formatDate(highlight.date)}</p>
                </div>
              </li>
            ))}
          </ul>
        </SectionBlock>

        <SectionBlock label={t("guardian.suggestions")}>
          <ul className="flex flex-col gap-3">
            {s.supportSuggestions.map((suggestion) => (
              <li key={suggestion} className="flex gap-3 rounded-lg border border-border bg-surface p-4">
                <HandHeart className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                <p className="text-sm leading-relaxed text-muted-foreground">{suggestion}</p>
              </li>
            ))}
          </ul>
        </SectionBlock>
      </div>

      <SectionBlock label={t("guardian.alerts")}>
        <ul className="flex flex-col gap-2">
          {s.alerts.map((alert) => (
            <li
              key={alert.text}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-4 text-sm",
                alert.level === "attention"
                  ? "border-warning/30 bg-warning-subtle text-warning-foreground"
                  : "border-border bg-surface text-muted-foreground",
              )}
            >
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {alert.text}
            </li>
          ))}
        </ul>
      </SectionBlock>

      <p className="flex items-start gap-2 rounded-lg border border-border bg-surface p-4 text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {t("guardian.respect")}
      </p>
    </div>
  );
}
