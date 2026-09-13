"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { TextAreaField } from "@/components/ui/textarea";
import { AnswerFormShell } from "@/features/assessment/components/answer-form-shell";
import type { QuestionComponentProps } from "@/features/assessment/components/question-renderer";
import { useT } from "@/lib/i18n/provider";
import {
  shortAnswerSchema,
  toAssessmentResponse,
  type ShortAnswerValues,
} from "@/schemas/assessment";
import { resolveZodMessage } from "@/schemas/auth";

/** Short answer — deliberately unconstrained: the prompt is the only requirement. */
export function ShortAnswerQuestion({
  question,
  isSubmitting,
  submitError,
  onRetrySubmit,
  onAnswer,
}: QuestionComponentProps) {
  const t = useT();
  const form = useForm<ShortAnswerValues>({
    resolver: zodResolver(shortAnswerSchema),
    defaultValues: { answer: "" },
  });
  const { errors } = form.formState;

  return (
    <AnswerFormShell
      question={question}
      typeLabelKey="assessment.question.shortAnswer"
      isSubmitting={isSubmitting}
      submitError={submitError}
      onRetrySubmit={onRetrySubmit}
      onFormSubmit={form.handleSubmit((values) => onAnswer(toAssessmentResponse(question, values)))}
    >
      <TextAreaField
        label={t("assessment.question.shortAnswer")}
        hideLabel
        rows={4}
        placeholder={t("assessment.typePlaceholder")}
        disabled={isSubmitting}
        aria-invalid={errors.answer ? true : undefined}
        error={errors.answer ? resolveZodMessage(errors.answer.message ?? "", t) : null}
        {...form.register("answer")}
      />
    </AnswerFormShell>
  );
}
