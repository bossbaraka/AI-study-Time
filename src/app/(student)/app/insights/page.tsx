"use client";

import { Lightbulb } from "lucide-react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { TrendAreaChart } from "@/components/charts/data-charts";
import { ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { SectionBlock } from "@/components/layout/section-block";
import { useBehaviorProfile } from "@/features/intelligence/hooks/use-intelligence";
import { useT } from "@/lib/i18n/provider";


/** Derived presentation data — stable trend shape for the mock phase. */
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

const RETENTION_TREND = [
  { label: "W1", value: 58 },
  { label: "W2", value: 63 },
  { label: "W3", value: 61 },
  { label: "W4", value: 69 },
  { label: "W5", value: 74 },
  { label: "W6", value: 72 },
  { label: "W7", value: 79 },
  { label: "W8", value: 81 },
];

export default function InsightsPage() {
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

  const insights = [
    { title: t("insights.insight1.title"), body: t("insights.insight1.body") },
    { title: t("insights.insight2.title"), body: t("insights.insight2.body") },
    { title: t("insights.insight3.title"), body: t("insights.insight3.body") },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("insights.title")} subtitle={t("insights.subtitle")} />

      <SectionBlock label={t("insights.progressTrend")}>
        <div
          className="rounded-lg border border-border bg-surface p-4 sm:p-5"
          role="img"
          aria-label={t("insights.progressTrend")}
        >
          <TrendAreaChart data={PROGRESS_TREND} />
        </div>
      </SectionBlock>

      <SectionBlock label={t("insights.recallRetention")}>
        <div
          className="rounded-lg border border-border bg-surface p-4 sm:p-5"
          role="img"
          aria-label={t("insights.recallRetention")}
        >
          <TrendAreaChart data={RETENTION_TREND} color="info" />
        </div>
      </SectionBlock>

      <SectionBlock label={t("profile.language")}>
        <ul className="flex flex-col gap-3">
          {insights.map((insight) => (
            <li key={insight.title} className="flex gap-3 rounded-lg border border-border bg-surface p-5">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-warning/30 bg-warning-subtle text-warning">
                <Lightbulb className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">{insight.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{insight.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </SectionBlock>
    </div>
  );
}
