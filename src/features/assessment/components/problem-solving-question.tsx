"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { TextAreaField } from "@/components/ui/textarea";
import { AnswerFormShell } from "@/features/assessment/components/answer-form-shell";
import type { QuestionComponentProps } from "@/features/assessment/components/question-renderer";
import { useT } from "@/lib/i18n/provider";
import {
  problemSolvingAnswerSchema,
  toAssessmentResponse,
  type ProblemSolvingAnswerValues,
} from "@/schemas/assessment";
import { resolveZodMessage } from "@/schemas/auth";

/**
 * Problem solving — language-agnostic by design: the student describes an
 * approach in prose or pseudocode. A future practical-task backend can add
 * structured payloads without changing this contract (still one response
 * variant keyed by `type`).
 */
export function ProblemSolvingQuestion({
  question,
  isSubmitting,
  submitError,
  onRetrySubmit,
  onAnswer,
}: QuestionComponentProps) {
  const t = useT();
  const form = useForm<ProblemSolvingAnswerValues>({
    resolver: zodResolver(problemSolvingAnswerSchema),
    defaultValues: { answer: "" },
  });
  const { errors } = form.formState;

  return (
    <AnswerFormShell
      question={question}
      typeLabelKey="assessment.question.problemSolving"
      isSubmitting={isSubmitting}
      submitError={submitError}
      onRetrySubmit={onRetrySubmit}
      onFormSubmit={form.handleSubmit((values) => onAnswer(toAssessmentResponse(question, values)))}
    >
      <TextAreaField
        label={t("assessment.question.problemSolving")}
        hideLabel
        rows={6}
        placeholder={t("assessment.typePlaceholder")}
        disabled={isSubmitting}
        aria-invalid={errors.answer ? true : undefined}
        error={errors.answer ? resolveZodMessage(errors.answer.message ?? "", t) : null}
        {...form.register("answer")}
      />
    </AnswerFormShell>
  );
}
