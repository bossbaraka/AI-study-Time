"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { TextAreaField } from "@/components/ui/textarea";
import type { NormalizedExecutionError } from "@/features/execution/lib/errors";
import { useT } from "@/lib/i18n/provider";
import { resolveZodMessage } from "@/schemas/auth";
import { evidenceFormSchema, type EvidenceFormValues } from "@/schemas/execution";

export interface EvidenceFormProps {
  /** Prefilled on retry so previous work is never lost. */
  defaultValues: EvidenceFormValues;
  isSubmitting: boolean;
  /** Service-level failure (conflict, network…) — normalized, never raw. */
  error: NormalizedExecutionError | null;
  onSubmit: (values: EvidenceFormValues) => void;
}

/**
 * The evidence form (§8): two honest text parts — the student's solution
 * and their own reasoning. No uploads, no integrations, no fake analysis.
 * Form-shape validation only; evidence quality belongs to the evaluator.
 */
export function EvidenceForm({ defaultValues, isSubmitting, error, onSubmit }: EvidenceFormProps) {
  const t = useT();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EvidenceFormValues>({
    resolver: zodResolver(evidenceFormSchema),
    defaultValues,
  });

  // A retry reopens the form with the previous evidence for editing.
  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const errorFor = (field: keyof EvidenceFormValues): string | null => {
    const issue = errors[field];
    const message = issue && "message" in issue ? issue.message : undefined;
    return message ? resolveZodMessage(message, t) : null;
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      aria-label={t("execution.evidence.title")}
      className="flex flex-col gap-4"
    >
      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-subtle px-3.5 py-3 text-sm leading-relaxed text-danger-foreground"
        >
          {t(error.messageKey)}
        </p>
      )}

      <TextAreaField
        label={t("execution.evidence.solutionLabel")}
        hint={t("execution.evidence.solutionHint")}
        rows={5}
        error={errorFor("solution")}
        {...register("solution")}
      />

      <TextAreaField
        label={t("execution.evidence.reasoningLabel")}
        hint={t("execution.evidence.reasoningHint")}
        rows={4}
        error={errorFor("reasoning")}
        {...register("reasoning")}
      />

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {isSubmitting ? t("execution.evidence.submitting") : t("execution.evidence.submit")}
      </Button>
    </form>
  );
}
