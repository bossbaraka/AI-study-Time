"use client";

import { motion } from "framer-motion";
import { ArrowRight, Award, CheckCircle2, CircleDashed, XCircle } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { useMastery } from "@/features/learning/hooks/use-learning";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { EvidenceState, ModuleMastery } from "@/types/domain";


const EVIDENCE_ICONS: Record<EvidenceState, typeof CheckCircle2> = {
  met: CheckCircle2,
  partial: XCircle,
  missing: CircleDashed,
};

const EVIDENCE_TONES: Record<EvidenceState, "success" | "danger" | "neutral"> = {
  met: "success",
  partial: "danger",
  missing: "neutral",
};

export default function MasteryPage() {
  const t = useT();
  const masteryQuery = useMastery();

  if (masteryQuery.isLoading) return <PageSkeleton blocks={2} />;
  if (masteryQuery.isError || !masteryQuery.data) {
    return (
      <ErrorState
        title={t("state.error.title")}
        body={t("state.error.body")}
        onRetry={() => void masteryQuery.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("mastery.title")} subtitle={t("mastery.subtitle")} />

      <div className="flex flex-col gap-5">
        {masteryQuery.data.map((module) => (
          <MasteryCard key={module.moduleId} module={module} />
        ))}
      </div>
    </div>
  );
}

function MasteryCard({ module }: { module: ModuleMastery }) {
  const t = useT();

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "rounded-xl border bg-surface p-6",
        module.achieved ? "border-mastery/40" : "border-border",
      )}
      aria-label={`${t("mastery.title")}: ${module.moduleTitle}`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-2xs text-muted-foreground">{module.phaseTitle}</p>
          <h2 className="mt-0.5 text-lg font-semibold tracking-tight">{module.moduleTitle}</h2>
        </div>
        {module.achieved ? (
          <Badge tone="mastery">
            <Award className="size-3" aria-hidden="true" />
            {t("mastery.achieved")}
          </Badge>
        ) : (
          <Badge tone="warning">{t("mastery.notAchieved")}</Badge>
        )}
      </header>

      {/* Task completion is shown, but visually subordinated to mastery */}
      <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
        {t("mastery.taskCompleted")}
        <ArrowRight className="size-3.5" aria-hidden="true" />
        <span className={cn("font-semibold", module.achieved ? "text-mastery" : "text-warning-foreground")}>
          {module.achieved ? t("mastery.achieved") : t("mastery.notAchieved")}
        </span>
      </p>

      {/* Evidence grid */}
      <ul className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {module.evidence.map((item) => {
          const Icon = EVIDENCE_ICONS[item.state];
          return (
            <li
              key={item.kind}
              className={cn(
                "rounded-lg border p-4",
                item.state === "met" && "border-success/30 bg-success-subtle/50",
                item.state === "partial" && "border-danger/30 bg-danger-subtle/50",
                item.state === "missing" && "border-border bg-background",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {t(`mastery.evidence.${item.kind}`)}
                </span>
                <Icon
                  className={cn(
                    "size-4",
                    item.state === "met" && "text-success",
                    item.state === "partial" && "text-danger",
                    item.state === "missing" && "text-muted-foreground",
                  )}
                  aria-hidden="true"
                />
              </div>
              <p className="tabular mt-2 text-xl font-semibold">
                {item.score !== null ? `${item.score}%` : t(`mastery.evidence.${item.state}`)}
              </p>
              {item.threshold !== null && (
                <p className="mt-0.5 text-2xs text-muted-foreground">
                  {t("mastery.threshold", { value: item.threshold })}
                </p>
              )}
              {item.note && (
                <p className="mt-1.5 text-2xs font-medium text-danger-foreground">{item.note}</p>
              )}
              <Badge tone={EVIDENCE_TONES[item.state]} className="mt-2">
                {t(`mastery.evidence.${item.state}`)}
              </Badge>
            </li>
          );
        })}
      </ul>

      {/* Next action — mastery always points forward */}
      {!module.achieved && module.nextAction && (
        <div className="mt-5 flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/8 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="micro-label">{t("mastery.nextAction")}</p>
            <p className="mt-1 text-sm font-semibold text-primary">«{t(module.nextAction)}»</p>
          </div>
          <div className="flex gap-2">
            <Link href="/app/recall">
              <Button variant="secondary" size="sm">{t("recall.title")}</Button>
            </Link>
            <Link href="/app/recovery">
              <Button size="sm">
                {t("recovery.start")}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Button>
            </Link>
          </div>
        </div>
      )}

      {module.achieved && (
        <p className="mt-5 rounded-lg border border-mastery/30 bg-mastery-subtle p-4 text-sm leading-relaxed text-mastery">
          {t("mastery.celebrate")}
        </p>
      )}
    </motion.section>
  );
}
