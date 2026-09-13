"use client";

import { PageSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { SectionBlock, StatTile } from "@/components/layout/section-block";
import {
  RecallEmpty,
  RecallSession,
} from "@/features/recall/components/recall-session";
import {
  useDueRecallCards,
  useRecallStats,
} from "@/features/learning/hooks/use-learning";
import { useT } from "@/lib/i18n/provider";


export default function RecallPage() {
  const t = useT();
  const cardsQuery = useDueRecallCards();
  const statsQuery = useRecallStats();

  if (cardsQuery.isLoading || statsQuery.isLoading) return <PageSkeleton blocks={2} />;
  if (cardsQuery.isError || statsQuery.isError) {
    return (
      <ErrorState
        title={t("state.error.title")}
        body={t("state.error.body")}
        onRetry={() => {
          void cardsQuery.refetch();
          void statsQuery.refetch();
        }}
      />
    );
  }

  const cards = cardsQuery.data ?? [];
  const stats = statsQuery.data;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("recall.title")} subtitle={t("recall.subtitle")} />

      {stats && (
        <SectionBlock>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label={t("recall.due")} value={String(stats.dueToday)} />
            <StatTile label={t("recall.completedToday")} value={String(stats.completedToday)} />
            <StatTile label={t("recall.retention")} value={`${stats.retentionRate}%`} />
            <StatTile label={t("recall.avgConfidence")} value={`${stats.averageConfidence}%`} />
          </div>
        </SectionBlock>
      )}

      {cards.length > 0 ? (
        <RecallSession cards={cards} />
      ) : (
        <RecallEmpty />
      )}
    </div>
  );
}
