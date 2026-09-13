"use client";

import { Loader2, TriangleAlert } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useT } from "@/lib/i18n/provider";
import type { NormalizedAssessmentError } from "@/features/assessment/lib/errors";
import type { AssessmentQuestion } from "@/types/assessment";

export interface AnswerFormShellProps {
  question: AssessmentQuestion;
  /** Translation key naming the question type (micro-label above the prompt). */
  typeLabelKey: string;
  children: ReactNode;
  /** Already-bound RHF submit handler. */
  onFormSubmit: () => void | Promise<void>;
  isSubmitting: boolean;
  submitError: NormalizedAssessmentError | null;
  onRetrySubmit: () => void;
  disabled?: boolean;
}

/**
 * Shared chrome for every question type: type label, optional scenario
 * context, prompt, instructions, the type-specific fields, the submission
 * failure banner (§16) and the submit row. Type components stay small and
 * independently maintainable.
 */
export function AnswerFormShell({
  question,
  typeLabelKey,
  children,
  onFormSubmit,
  isSubmitting,
  submitError,
  onRetrySubmit,
  disabled,
}: AnswerFormShellProps) {
  const t = useT();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void onFormSubmit();
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <p className="micro-label">{t(typeLabelKey)}</p>
        {question.context && (
          <Card className="bg-surface-raised p-4">
            <p className="text-sm leading-relaxed text-muted-foreground">{question.context}</p>
          </Card>
        )}
        <h2 className="text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
          {question.prompt}
        </h2>
        {question.instructions && (
          <p className="text-sm leading-relaxed text-muted-foreground">{question.instructions}</p>
        )}
      </header>

      {children}

      {submitError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-danger/40 bg-danger/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger-foreground" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">
                {submitError.retryable
                  ? t("assessment.errors.saveFailedTitle")
                  : t(submitError.messageKey)}
              </p>
              {submitError.retryable && (
                <p className="text-xs text-muted-foreground">
                  {t("assessment.errors.saveFailedBody")}
                </p>
              )}
            </div>
          </div>
          {submitError.retryable && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onRetrySubmit}
              disabled={isSubmitting}
              className="shrink-0"
            >
              {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {t("assessment.tryAgain")}
            </Button>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={isSubmitting || disabled}>
          {isSubmitting ? t("assessment.submitting") : t("assessment.submitAnswer")}
          {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        </Button>
      </div>
    </form>
  );
}
