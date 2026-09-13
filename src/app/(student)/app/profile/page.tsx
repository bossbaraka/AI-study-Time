"use client";

import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { CapabilityRadarChart } from "@/components/charts/data-charts";
import { ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { SectionBlock } from "@/components/layout/section-block";
import { useBehaviorProfile } from "@/features/intelligence/hooks/use-intelligence";
import { useStudent } from "@/features/journey/hooks/use-journey";
import { useT } from "@/lib/i18n/provider";


/**
 * Student Intelligence Profile.
 * Framed strictly as observed patterns — never diagnosis.
 * Vocabulary: "Learning insight", "Observed pattern", "Behavioral indicator".
 */
export default function ProfilePage() {
  const t = useT();
  const behaviorQuery = useBehaviorProfile();
  const studentQuery = useStudent();

  if (behaviorQuery.isLoading || studentQuery.isLoading) return <PageSkeleton blocks={3} />;
  if (behaviorQuery.isError || !behaviorQuery.data) {
    return (
      <ErrorState
        title={t("state.error.title")}
        body={t("state.error.body")}
        onRetry={() => void behaviorQuery.refetch()}
      />
    );
  }

  const b = behaviorQuery.data;

  const learningDimensions = [
    { key: "profile.learningSpeed", value: b.learningSpeed },
    { key: "profile.comprehension", value: b.comprehension },
    { key: "profile.recall", value: b.recall },
    { key: "profile.problemSolving", value: b.problemSolving },
  ];

  const executionDimensions = [
    { key: "profile.focus", value: b.focus },
    { key: "profile.discipline", value: b.discipline },
    { key: "profile.consistency", value: b.consistency },
    { key: "profile.timeManagement", value: b.timeManagement },
  ];

  const radarData = [...learningDimensions, ...executionDimensions].map((d) => ({
    axis: t(d.key),
    value: d.value,
  }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("profile.title")}
        subtitle={t("profile.subtitle")}
        actions={<Badge tone="neutral">{t("profile.indicator")}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <SectionBlock label={t("profile.learning")}>
            <DimensionList dimensions={learningDimensions} />
          </SectionBlock>

          <SectionBlock label={t("profile.execution")}>
            <DimensionList dimensions={executionDimensions} />
          </SectionBlock>
        </div>

        <SectionBlock label={t("insights.masteryRadar")}>
          <div
            className="rounded-lg border border-border bg-surface p-4"
            role="img"
            aria-label={t("insights.masteryRadar")}
          >
            <CapabilityRadarChart data={radarData} />
          </div>
        </SectionBlock>
      </div>

      {/* Behavioral patterns summary */}
      <SectionBlock label={t("behavior.patterns")}>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: t("behavior.bestTime"), value: b.bestStudyWindow },
            { label: t("behavior.avgSession"), value: `${b.averageSessionMinutes} min` },
            { label: t("behavior.recoverySuccess"), value: `${b.recoverySuccessRate}%` },
            { label: t("behavior.completionConsistency"), value: `${b.completionConsistency}%` },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-border bg-surface p-4">
              <dt className="text-xs text-muted-foreground">{item.label}</dt>
              <dd className="mt-1 text-base font-semibold tracking-tight">{item.value}</dd>
            </div>
          ))}
        </dl>
      </SectionBlock>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">{t("profile.language")}: </span>
          {t("profile.disclaimer")}
        </p>
      </div>
    </div>
  );
}

function DimensionList({ dimensions }: { dimensions: { key: string; value: number }[] }) {
  const t = useT();
  return (
    <ul className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      {dimensions.map((dim) => (
        <li key={dim.key}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{t(dim.key)}</span>
            <span className="tabular text-sm font-semibold">{dim.value}</span>
          </div>
          <Progress
            value={dim.value}
            size="sm"
            className="mt-2"
            tone={dim.value >= 75 ? "success" : dim.value >= 55 ? "primary" : "warning"}
            label={t(dim.key)}
          />
        </li>
      ))}
    </ul>
  );
}
