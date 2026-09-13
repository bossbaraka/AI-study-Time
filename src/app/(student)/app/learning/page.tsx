"use client";

import {
  BookOpen,
  ExternalLink,
  FileText,
  Film,
  FolderKanban,
  PencilRuler,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { SectionBlock } from "@/components/layout/section-block";
import { useResources } from "@/features/learning/hooks/use-learning";
import { useT } from "@/lib/i18n/provider";
import type { LearningResource, ResourceKind } from "@/types/domain";


const KIND_ICONS: Record<ResourceKind, typeof BookOpen> = {
  video: Film,
  article: FileText,
  documentation: BookOpen,
  exercise: PencilRuler,
  project: FolderKanban,
};

export default function LearningPage() {
  const t = useT();
  const resourcesQuery = useResources();

  if (resourcesQuery.isLoading) return <PageSkeleton blocks={2} />;
  if (resourcesQuery.isError || !resourcesQuery.data) {
    return (
      <ErrorState
        title={t("state.error.title")}
        body={t("state.error.body")}
        onRetry={() => void resourcesQuery.refetch()}
      />
    );
  }

  const resources = resourcesQuery.data;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("learning.title")}
        subtitle={t("learning.subtitle")}
        actions={<Badge tone="primary">{t("learning.currentPhaseOnly")}</Badge>}
      />

      {resources.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={t("tests.empty.title")}
          body={t("state.error.body")}
        />
      ) : (
        <SectionBlock>
          <ul className="flex flex-col gap-3">
            {resources.map((resource) => (
              <ResourceRow key={resource.id} resource={resource} />
            ))}
          </ul>
        </SectionBlock>
      )}
    </div>
  );
}

function ResourceRow({ resource }: { resource: LearningResource }) {
  const t = useT();
  const Icon = KIND_ICONS[resource.kind];

  return (
    <li>
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-border-strong focus-visible:shadow-focus focus-visible:outline-none sm:p-5"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-semibold">{resource.title}</span>
            <Badge tone="neutral">{t(`learning.kind.${resource.kind}`)}</Badge>
          </span>
          <span className="tabular mt-1 block text-xs text-muted-foreground">
            {resource.provider} · {resource.durationMinutes} {t("common.minutes")}
          </span>
        </span>
        <span className="hidden shrink-0 items-center gap-1.5 text-xs font-medium text-primary sm:flex">
          {t("learning.openResource")}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </span>
      </a>
    </li>
  );
}
