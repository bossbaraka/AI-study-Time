"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { TextAreaField } from "@/components/ui/textarea";
import { AnswerFormShell } from "@/features/assessment/components/answer-form-shell";
import { OptionRadioList } from "@/features/assessment/components/option-radio-list";
import type { QuestionComponentProps } from "@/features/assessment/components/question-renderer";
import { useT } from "@/lib/i18n/provider";
import {
  scenarioAnswerSchema,
  toAssessmentResponse,
  type ScenarioAnswerValues,
} from "@/schemas/assessment";
import { resolveZodMessage } from "@/schemas/auth";

/** Scenario — a required direction plus optional structured reasoning. */
export function ScenarioQuestion({
  question,
  isSubmitting,
  submitError,
  onRetrySubmit,
  onAnswer,
}: QuestionComponentProps) {
  const t = useT();
  const form = useForm<ScenarioAnswerValues>({
    resolver: zodResolver(scenarioAnswerSchema),
    defaultValues: { optionId: "", reasoning: "" },
  });
  const { errors } = form.formState;

  return (
    <AnswerFormShell
      question={question}
      typeLabelKey="assessment.question.scenario"
      isSubmitting={isSubmitting}
      submitError={submitError}
      onRetrySubmit={onRetrySubmit}
      onFormSubmit={form.handleSubmit((values) => onAnswer(toAssessmentResponse(question, values)))}
    >
      <div className="flex flex-col gap-5">
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
              error={errors.optionId ? resolveZodMessage(errors.optionId.message ?? "", t) : null}
              disabled={isSubmitting}
            />
          )}
        />
        <TextAreaField
          label={t("assessment.question.reasoningOptional")}
          rows={3}
          placeholder={t("assessment.typePlaceholder")}
          disabled={isSubmitting}
          {...form.register("reasoning")}
        />
      </div>
    </AnswerFormShell>
  );
}
