"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { AnswerFormShell } from "@/features/assessment/components/answer-form-shell";
import { OptionRadioList } from "@/features/assessment/components/option-radio-list";
import type { QuestionComponentProps } from "@/features/assessment/components/question-renderer";
import { useT } from "@/lib/i18n/provider";
import {
  multipleChoiceAnswerSchema,
  toAssessmentResponse,
  type MultipleChoiceAnswerValues,
} from "@/schemas/assessment";
import { resolveZodMessage } from "@/schemas/auth";

/** Multiple choice — accessible radio-group semantics via native inputs. */
export function MultipleChoiceQuestion({
  question,
  isSubmitting,
  submitError,
  onRetrySubmit,
  onAnswer,
}: QuestionComponentProps) {
  const t = useT();
  const form = useForm<MultipleChoiceAnswerValues>({
    resolver: zodResolver(multipleChoiceAnswerSchema),
    defaultValues: { optionId: "" },
  });
  const { errors } = form.formState;

  return (
    <AnswerFormShell
      question={question}
      typeLabelKey="assessment.question.multipleChoice"
      isSubmitting={isSubmitting}
      submitError={submitError}
      onRetrySubmit={onRetrySubmit}
      onFormSubmit={form.handleSubmit((values) => onAnswer(toAssessmentResponse(question, values)))}
    >
      <Controller
        control={form.control}
        name="optionId"
        render={({ field }) => (
          <OptionRadioList
            options={question.options ?? []}
            legend={question.prompt}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            name={field.name}
            error={
              errors.optionId ? resolveZodMessage(errors.optionId.message ?? "", t) : null
            }
            disabled={isSubmitting}
          />
        )}
      />
    </AnswerFormShell>
  );
}
