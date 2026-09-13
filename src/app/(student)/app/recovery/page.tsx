"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check, LifeBuoy, Stethoscope } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { useActiveRecovery, useAdvanceRecoveryStep } from "@/features/intelligence/hooks/use-intelligence";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { RECOVERY_STEPS } from "@/constants/journey";


/**
 * Recovery — failure reframed as information.
 * No shameful language: "You haven't mastered this yet.
 * That's useful information." Then a fixed pipeline to the retest.
 */
export default function RecoveryPage() {
  const t = useT();
  const recoveryQuery = useActiveRecovery();
  const advanceStep = useAdvanceRecoveryStep();

  if (recoveryQuery.isLoading) return <PageSkeleton blocks={2} />;
  if (recoveryQuery.isError) {
    return (
      <ErrorState
        title={t("state.error.title")}
        body={t("state.error.body")}
        onRetry={() => void recoveryQuery.refetch()}
      />
    );
  }

  const plan = recoveryQuery.data;

  if (!plan) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader title={t("recovery.title")} subtitle={t("recovery.subtitle")} />
        <EmptyState
          icon={LifeBuoy}
          title={t("recovery.empty.title")}
          body={t("recovery.empty.body")}
        />
      </div>
    );
  }

  const currentIndex = RECOVERY_STEPS.indexOf(plan.currentStep);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("recovery.title")}
        subtitle={t("recovery.subtitle")}
        actions={<Badge tone="info">{t("recovery.active")}</Badge>}
      />

      {/* Reframe: calm, factual, forward-looking */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="rounded-xl border border-border bg-surface p-6 sm:p-8"
      >
        <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {t("recovery.headline")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("recovery.subheadline")}</p>

        <div className="mt-6 flex gap-3 rounded-lg border border-info/25 bg-info-subtle p-4">
          <Stethoscope className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
          <div>
            <p className="text-xs font-medium text-info-foreground">
              {t("recovery.diagnosisLabel")}:
            </p>
            <p className="mt-1 text-sm font-semibold text-info-foreground">
              [{plan.diagnosis}]
            </p>
            <p className="mt-2 text-xs text-info-foreground/80">{plan.triggerReason}</p>
          </div>
        </div>

        <div className="mt-6">
          <Link href="/app/mentor">
            <Button>
              {t("recovery.start")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </motion.section>

      {/* Recovery timeline: Diagnosis → Review → Practice → Recall → Retest */}
      <section aria-label={t("recovery.timeline")} className="rounded-xl border border-border bg-surface p-6">
        <h2 className="micro-label">{t("recovery.timeline")}</h2>
        <ol className="mt-5 flex flex-col gap-0">
          {plan.steps.map((step, index) => {
            const isCurrent = index === currentIndex;
            const isDone = step.done;
            return (
              <li key={step.step} className="flex items-stretch gap-4">
                <div className="flex flex-col items-center">
                  <motion.span
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: index * 0.07 }}
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                      isDone && "border-success/40 bg-success-subtle text-success-foreground",
                      isCurrent && !isDone && "border-info bg-info text-white shadow-xs",
                      !isDone && !isCurrent && "border-border bg-background text-muted-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {isDone ? <Check className="size-4" /> : index + 1}
                  </motion.span>
                  {index < plan.steps.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={cn("w-px flex-1", isDone ? "bg-success/40" : "bg-border")}
                    />
                  )}
                </div>
                <div className={cn("flex flex-1 flex-col gap-1 pb-6", !isDone && !isCurrent && "opacity-60")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{t(`recovery.step.${step.step}`)}</p>
                    {isCurrent && !isDone && <Badge tone="info">{t("common.today")}</Badge>}
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{step.detail}</p>
                  {isCurrent && !isDone && (
                    <div className="mt-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => advanceStep.mutate(step.step)}
                        disabled={advanceStep.isPending}
                      >
                        {t("common.complete")}
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          {t("recovery.tone")}
        </p>
      </section>
    </div>
  );
}
