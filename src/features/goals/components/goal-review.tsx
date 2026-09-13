"use client";

import { CheckCircle2, CircleAlert, Loader2, Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { GoalSummary } from "@/features/goals/components/goal-summary";
import { ValidationIssues } from "@/features/goals/components/validation-issues";
import type { NormalizedGoalError } from "@/features/goals/lib/errors";
import { useT } from "@/lib/i18n/provider";
import type { LearningGoal } from "@/types/goal";

export interface GoalReviewProps {
  goal: LearningGoal;
  onEdit: () => void;
  onLock: () => void;
  isLocking: boolean;
  lockError: NormalizedGoalError | null;
  onRetryLock: () => void;
}

/**
 * Review step (§12): a calm summary, "what looks strong" vs "what still
 * needs attention", and the explicit lock action. Locking re-validates in
 * the engine — an invalid goal can never reach LOCKED (§13).
 */
export function GoalReview({
  goal,
  onEdit,
  onLock,
  isLocking,
  lockError,
  onRetryLock,
}: GoalReviewProps) {
  const t = useT();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const validation = goal.validation;

  const strong = (validation?.quality ?? []).filter((entry) => entry.verdict === "strong");
  const attention = (validation?.quality ?? []).filter(
    (entry) =>
      entry.verdict === "weak" &&
      // Alignment is informational only — a mismatch is the student's right.
      entry.dimension !== "alignment",
  );
  const warnings = (validation?.issues ?? []).filter((issue) => issue.severity === "warning");

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="micro-label">{t("goals.review.kicker")}</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("goals.review.title")}
        </h1>
      </header>

      <Card>
        <CardContent className="p-6">
          <GoalSummary goal={goal} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {strong.length > 0 && (
          <section aria-label={t("goals.quality.strongLabel")} className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              {t("goals.quality.strongLabel")}
            </h2>
            <ul className="flex flex-col gap-1.5">
              {strong.map((entry) => (
                <li key={entry.dimension} className="text-sm text-muted-foreground">
                  {t(`goals.quality.${entry.dimension}.strong`)}
                </li>
              ))}
            </ul>
          </section>
        )}
        {(attention.length > 0 || warnings.length > 0) && (
          <section aria-label={t("goals.quality.attentionLabel")} className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <CircleAlert className="size-4 text-muted-foreground" aria-hidden="true" />
              {t("goals.quality.attentionLabel")}
            </h2>
            <ul className="flex flex-col gap-1.5">
              {warnings.map((issue) => (
                <li key={issue.code} className="text-sm text-muted-foreground">
                  {t(`goals.issues.${issue.code}`)}
                </li>
              ))}
              {attention.map((entry) => (
                <li key={entry.dimension} className="text-sm text-muted-foreground">
                  {t(`goals.quality.${entry.dimension}.weak`)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* Lock-failure feedback: transport failures offer a safe retry with the
          same idempotency key; validation races surface the issues (§13/§14). */}
      {lockError && lockError.retryable && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-md border border-danger/40 bg-danger/5 px-4 py-3"
        >
          <p className="flex-1 text-sm text-danger-foreground">{t(lockError.messageKey)}</p>
          <Button variant="secondary" size="sm" onClick={onRetryLock} disabled={isLocking}>
            {t("common.retry")}
          </Button>
        </div>
      )}
      {lockError && !lockError.retryable && lockError.code === "validation_failed" && validation && (
        <ValidationIssues validation={validation} />
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          size="lg"
          onClick={() => setConfirmOpen(true)}
          disabled={isLocking || goal.validation?.valid === false}
        >
          <Lock className="size-4" aria-hidden="true" />
          {t("goals.review.lockCta")}
        </Button>
        <Button variant="ghost" onClick={onEdit} disabled={isLocking}>
          {t("goals.review.edit")}
        </Button>
        {isLocking && (
          <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            {t("goals.review.locking")}
          </p>
        )}
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("goals.review.lockDialog.title")}
        description={t("goals.review.lockDialog.body")}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={isLocking}>
              {t("goals.review.lockDialog.cancel")}
            </Button>
            <Button
              onClick={() => {
                setConfirmOpen(false);
                onLock();
              }}
              disabled={isLocking}
            >
              {isLocking && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {t("goals.review.lockDialog.confirm")}
            </Button>
          </>
        }
      />
    </div>
  );
}
