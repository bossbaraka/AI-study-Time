"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EvidenceForm } from "@/features/execution/components/evidence-form";
import { UnitResult } from "@/features/execution/components/unit-result";
import {
  useEvaluateUnit,
  useStartUnit,
  useSubmitEvidence,
  useUnitContext,
} from "@/features/execution/hooks/use-execution";
import { normalizeExecutionError } from "@/features/execution/lib/errors";
import { UNIT_ICONS } from "@/features/roadmap/components/learning-unit-row";
import { useT } from "@/lib/i18n/provider";
import { formatDuration } from "@/lib/utils";
import type { EvidenceFormValues } from "@/schemas/execution";
import type { UnitLearningContext } from "@/types/execution";

export interface UnitLearnFlowProps {
  learningUnitId: string;
}

/**
 * The learn screen (§20/§21): one unit, one clear current action.
 *
 *   available   → brief + [Start learning]
 *   in_progress → brief + task + evidence form + [Submit evidence]
 *   submitted   → evidence recap + [Check my evidence]
 *   evaluated   → honest result + next unit / explicit retry
 *   blocked     → honest "not yet" + way back
 *
 * All state comes from the service query (refresh-safe, §17) — never
 * from localStorage or UI memory.
 */
export function UnitLearnFlow({ learningUnitId }: UnitLearnFlowProps) {
  const t = useT();
  const router = useRouter();
  const contextQuery = useUnitContext(learningUnitId);
  const start = useStartUnit();
  const submit = useSubmitEvidence();
  const evaluate = useEvaluateUnit();

  const context = contextQuery.data ?? null;
  const contextError = contextQuery.isError
    ? normalizeExecutionError(contextQuery.error)
    : null;

  // No executable roadmap behind this unit (none at all, or paused) —
  // the roadmap page owns that story.
  useEffect(() => {
    if (contextError?.code === "unit_unavailable") router.replace("/roadmap");
  }, [contextError?.code, router]);

  if (contextQuery.isPending) return <PageSkeleton blocks={2} />;

  if (contextError) {
    // Redirect in flight — keep the skeleton instead of flashing an error.
    if (contextError.code === "unit_unavailable") return <PageSkeleton blocks={2} />;
    if (contextError.code === "execution_not_found") {
      return (
        <EmptyState
          title={t("execution.errors.notFound")}
          body={t("execution.notFound.body")}
          actionLabel={t("execution.back")}
          onAction={() => router.push("/roadmap")}
        />
      );
    }
    return (
      <ErrorState
        title={t("execution.loadError.title")}
        body={t(contextError.messageKey)}
        onRetry={contextError.retryable ? () => void contextQuery.refetch() : undefined}
      />
    );
  }

  if (!context) return <PageSkeleton blocks={2} />;

  return (
    <div className="flex flex-col gap-8">
      <UnitContextHeader context={context} />

      {context.status === "blocked" && (
        <EmptyState
          title={t("execution.blocked.title")}
          body={t("execution.blocked.body", { name: context.milestone.title })}
          actionLabel={t("execution.back")}
          onAction={() => router.push("/roadmap")}
        />
      )}

      {context.status === "available" && (
        <section aria-label={t("execution.brief.label")} className="flex flex-col gap-5">
          <UnitBrief context={context} />
          <div className="flex flex-col items-start gap-2">
            <Button
              type="button"
              onClick={() => start.mutate(learningUnitId)}
              disabled={start.isPending}
            >
              {start.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {start.isPending ? t("execution.start.starting") : t("execution.start.cta")}
            </Button>
            {start.isError && (
              <p role="alert" className="text-xs font-medium text-danger-foreground">
                {t(normalizeExecutionError(start.error).messageKey)}
              </p>
            )}
          </div>
        </section>
      )}

      {context.status === "in_progress" && (
        <InProgressScreen
          context={context}
          isSubmitting={submit.isPending}
          submitError={submit.isError ? normalizeExecutionError(submit.error) : null}
          onSubmit={(values) => submit.mutate({ unitId: learningUnitId, input: values })}
        />
      )}

      {context.status === "submitted" && (
        <SubmittedScreen
          context={context}
          isEvaluating={evaluate.isPending}
          evaluateError={evaluate.isError ? normalizeExecutionError(evaluate.error) : null}
          onEvaluate={() => evaluate.mutate(learningUnitId)}
        />
      )}

      {(context.status === "passed" ||
        context.status === "needs_review" ||
        context.status === "failed") && (
        <UnitResult
          context={context}
          isRetrying={start.isPending}
          onRetry={() => start.mutate(learningUnitId)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */

function UnitContextHeader({ context }: { context: UnitLearningContext }) {
  const t = useT();
  const Icon = UNIT_ICONS[context.unit.type];
  return (
    <header className="flex flex-col gap-3">
      <Link
        href="/roadmap"
        className="self-start text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {t("execution.back")}
      </Link>
      <div>
        <p className="micro-label">
          {t("execution.context.milestone", {
            order: context.milestone.order + 1,
            name: context.milestone.title,
          })}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {context.unit.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge tone="neutral">
            <Icon aria-hidden="true" />
            {t(`roadmap.units.types.${context.unit.type}`)}
          </Badge>
          <span className="tabular text-xs text-muted-foreground">
            {t("execution.brief.time")}: {formatDuration(context.unit.estimatedMinutes)}
          </span>
        </div>
      </div>
    </header>
  );
}

function BriefRow({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm leading-relaxed text-foreground">{text}</p>
    </div>
  );
}

function UnitBrief({ context }: { context: UnitLearningContext }) {
  const t = useT();
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <BriefRow label={t("execution.brief.purpose")} text={context.unit.purpose} />
        <BriefRow label={t("roadmap.units.outcome")} text={context.unit.expectedOutcome} />
        <BriefRow label={t("roadmap.units.evidence")} text={context.unit.completionEvidence} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("execution.brief.evidenceHow")}
        </p>
      </CardContent>
    </Card>
  );
}

interface InProgressScreenProps {
  context: UnitLearningContext;
  isSubmitting: boolean;
  submitError: ReturnType<typeof normalizeExecutionError> | null;
  onSubmit: (values: EvidenceFormValues) => void;
}

/** In progress (and its retry states): brief + task + evidence form. */
function InProgressScreen({ context, isSubmitting, submitError, onSubmit }: InProgressScreenProps) {
  const t = useT();
  const evidence = context.execution?.evidence;
  // Primitive-keyed memo: unrelated re-renders never reset the student's
  // typing; only a genuinely different stored evidence prefills the form.
  const defaultValues = useMemo<EvidenceFormValues>(
    () => ({
      solution: evidence?.solution ?? "",
      reasoning: evidence?.reasoning ?? "",
    }),
    [evidence?.solution, evidence?.reasoning],
  );

  return (
    <section aria-label={t("execution.task.title")} className="flex flex-col gap-6">
      <UnitBrief context={context} />
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{t("execution.task.title")}</h2>
        <ol className="flex list-decimal flex-col gap-1.5 ps-5 text-sm leading-relaxed text-muted-foreground">
          <li>{t("execution.task.step1")}</li>
          <li>{t("execution.task.step2")}</li>
          <li>{t("execution.task.step3")}</li>
        </ol>
      </div>
      <EvidenceForm
        defaultValues={defaultValues}
        isSubmitting={isSubmitting}
        error={submitError}
        onSubmit={onSubmit}
      />
    </section>
  );
}

interface SubmittedScreenProps {
  context: UnitLearningContext;
  isEvaluating: boolean;
  evaluateError: ReturnType<typeof normalizeExecutionError> | null;
  onEvaluate: () => void;
}

/** Submitted: recap of the evidence + the explicit evaluation action. */
function SubmittedScreen({ context, isEvaluating, evaluateError, onEvaluate }: SubmittedScreenProps) {
  const t = useT();
  const evidence = context.execution?.evidence;
  return (
    <section aria-label={t("execution.submitted.title")} className="flex flex-col gap-5">
      <Card>
        <CardContent className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold tracking-tight">
              {t("execution.submitted.title")}
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("execution.submitted.body")}
            </p>
          </div>
          {evidence && (
            <>
              <EvidenceRecap
                label={t("execution.submitted.solutionLabel")}
                text={evidence.solution}
              />
              <EvidenceRecap
                label={t("execution.submitted.reasoningLabel")}
                text={evidence.reasoning}
              />
            </>
          )}
        </CardContent>
      </Card>
      <div className="flex flex-col items-start gap-3">
        <Button type="button" onClick={onEvaluate} disabled={isEvaluating}>
          {isEvaluating && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isEvaluating
            ? t("execution.submitted.evaluating")
            : t("execution.submitted.evaluate")}
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("execution.submitted.honestNote")}
        </p>
        {evaluateError && (
          <p role="alert" className="text-xs font-medium text-danger-foreground">
            {t(evaluateError.messageKey)}
          </p>
        )}
      </div>
    </section>
  );
}

function EvidenceRecap({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{text}</p>
    </div>
  );
}
