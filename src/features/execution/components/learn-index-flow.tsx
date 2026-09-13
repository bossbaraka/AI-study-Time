"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useExecutionView } from "@/features/execution/hooks/use-execution";
import { normalizeExecutionError } from "@/features/execution/lib/errors";
import { useT } from "@/lib/i18n/provider";

/**
 * /roadmap/learn — "take me to my current unit".
 *
 * Pure resolver: no roadmap → /roadmap owns the story; a current unit →
 * replace-navigate to its learn screen (Back never loops here); every
 * unit passed → an honest done state (roadmap completion semantics are
 * NOT decided here — §12).
 */
export function LearnIndexFlow() {
  const t = useT();
  const router = useRouter();
  const viewQuery = useExecutionView();
  const view = viewQuery.data ?? null;

  useEffect(() => {
    if (viewQuery.isPending || viewQuery.isError) return;
    if (!view) {
      router.replace("/roadmap");
      return;
    }
    if (view.currentUnit) {
      router.replace(`/roadmap/learn/${view.currentUnit.id}`);
    }
  }, [viewQuery.isPending, viewQuery.isError, view, router]);

  if (viewQuery.isPending) return <PageSkeleton blocks={1} />;

  if (viewQuery.isError) {
    const normalized = normalizeExecutionError(viewQuery.error);
    return (
      <ErrorState
        title={t("execution.loadError.title")}
        body={t(normalized.messageKey)}
        onRetry={normalized.retryable ? () => void viewQuery.refetch() : undefined}
      />
    );
  }

  if (view?.currentUnit) {
    // Redirect in flight.
    return <PageSkeleton blocks={1} />;
  }

  if (!view) {
    // Redirect in flight (no roadmap at all).
    return <PageSkeleton blocks={1} />;
  }

  // View exists, no current unit: every unit has passed.
  return (
    <EmptyState
      title={t("execution.done.title")}
      body={t("execution.done.body")}
      actionLabel={t("execution.done.backCta")}
      onAction={() => router.push("/roadmap")}
    />
  );
}
