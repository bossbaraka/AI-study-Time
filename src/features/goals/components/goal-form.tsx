"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, TriangleAlert, X } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { TextAreaField } from "@/components/ui/textarea";
import {
  ChoiceChips,
  ToggleChips,
  type ChoiceOption,
} from "@/features/goals/components/choice-chips";
import {
  COMMITMENT_OPTIONS,
  CONSTRAINT_OPTIONS,
  CURRENT_LEVEL_OPTIONS,
  DOMAIN_OPTIONS,
  GOAL_KEY_PREFIXES,
  MOTIVATION_OPTIONS,
  TARGET_LEVEL_OPTIONS,
  TIMEFRAME_OPTIONS,
} from "@/features/goals/constants/goal-discovery.constants";
import type { NormalizedGoalError } from "@/features/goals/lib/errors";
import { useT } from "@/lib/i18n/provider";
import { resolveZodMessage } from "@/schemas/auth";
import {
  emptyGoalFormValues,
  goalDiscoveryFormSchema,
  toGoalDiscoveryInput,
  type GoalDiscoveryFormValues,
} from "@/schemas/goal";
import type { CurrentLevel, GoalDiscoveryInput } from "@/types/goal";

export interface GoalFormProps {
  /** Edit mode renders the success-criteria editor; create mode lets the engine draft them. */
  mode: "create" | "edit";
  defaultValues: GoalDiscoveryFormValues;
  /** Shown under the current-level section when prefilled from the diagnosis. */
  diagnosisPrefill?: CurrentLevel;
  isSubmitting: boolean;
  submitError: NormalizedGoalError | null;
  onRetrySubmit: () => void;
  onSubmitInput: (input: GoalDiscoveryInput) => void;
}

function chipOptions(prefix: string, values: readonly string[], t: (key: string) => string): ChoiceOption[] {
  return values.map((value) => ({ value, label: t(`${prefix}${value}`) }));
}

/**
 * The goal discovery/refinement form. Form state is React Hook Form;
 * quality judgement is NOT done here — the engine validates after submit.
 * On submission failure all entered data stays untouched (§20).
 */
export function GoalForm({
  mode,
  defaultValues,
  diagnosisPrefill,
  isSubmitting,
  submitError,
  onRetrySubmit,
  onSubmitInput,
}: GoalFormProps) {
  const t = useT();
  const form = useForm<GoalDiscoveryFormValues>({
    resolver: zodResolver(goalDiscoveryFormSchema),
    defaultValues: defaultValues ?? emptyGoalFormValues(),
  });
  const { errors } = form.formState;
  const { watch, setValue, register, control } = form;

  const { fields, append, remove } = useFieldArray({ control, name: "successCriteria" });

  const domainChoice = watch("domainChoice");
  const motivationKind = watch("motivationKind");
  const timeframePreset = watch("timeframePreset");
  const commitmentPreset = watch("commitmentPreset");
  const constraints = watch("constraints") ?? [];

  const errorFor = (field: keyof GoalDiscoveryFormValues): string | null => {
    const issue = errors[field];
    const message = issue && "message" in issue ? issue.message : undefined;
    return message ? resolveZodMessage(message, t) : null;
  };

  const handleValidSubmit = (values: GoalDiscoveryFormValues) => {
    onSubmitInput(toGoalDiscoveryInput(values));
  };

  return (
    <form
      onSubmit={form.handleSubmit(handleValidSubmit)}
      noValidate
      className="flex flex-col gap-8"
    >
      {/* A — Target domain */}
      <div className="flex flex-col gap-3">
        <ChoiceChips
          legend={t("goals.form.domainLabel")}
          name="domainChoice"
          options={chipOptions(GOAL_KEY_PREFIXES.domain, DOMAIN_OPTIONS, t)}
          value={domainChoice}
          onChange={(value) => setValue("domainChoice", value, { shouldValidate: true })}
          error={errorFor("domainChoice")}
          disabled={isSubmitting}
        />
        {domainChoice === "custom" && (
          <InputField
            label={t("goals.form.domainCustomLabel")}
            placeholder={t("goals.form.domainCustomPlaceholder")}
            error={errorFor("customDomain")}
            disabled={isSubmitting}
            {...register("customDomain")}
          />
        )}
      </div>

      {/* B — Desired outcome */}
      <div className="flex flex-col gap-2">
        <TextAreaField
          label={t("goals.form.outcomeLabel")}
          rows={3}
          placeholder={t("goals.form.outcomePlaceholder")}
          hint={t("goals.form.outcomeHint")}
          error={errorFor("desiredOutcome")}
          disabled={isSubmitting}
          {...register("desiredOutcome")}
        />
      </div>

      {/* C — Motivation */}
      <div className="flex flex-col gap-3">
        <ChoiceChips
          legend={t("goals.form.motivationLabel")}
          name="motivationKind"
          options={chipOptions(GOAL_KEY_PREFIXES.motivation, MOTIVATION_OPTIONS, t)}
          value={motivationKind}
          onChange={(value) => setValue("motivationKind", value, { shouldValidate: true })}
          error={errorFor("motivationKind")}
          disabled={isSubmitting}
        />
        {motivationKind === "other" && (
          <InputField
            label={t("goals.form.motivationNoteLabel")}
            placeholder={t("goals.form.motivationNotePlaceholder")}
            error={errorFor("motivationNote")}
            disabled={isSubmitting}
            {...register("motivationNote")}
          />
        )}
      </div>

      {/* D/E — Current & target level */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <ChoiceChips
            legend={t("goals.form.currentLevelLabel")}
            name="currentLevel"
            options={chipOptions(GOAL_KEY_PREFIXES.currentLevel, CURRENT_LEVEL_OPTIONS, t)}
            value={watch("currentLevel")}
            onChange={(value) => setValue("currentLevel", value, { shouldValidate: true })}
            error={errorFor("currentLevel")}
            disabled={isSubmitting}
          />
          {diagnosisPrefill && (
            <p className="text-xs text-muted-foreground">{t("goals.form.currentLevelPrefilled")}</p>
          )}
        </div>
        <ChoiceChips
          legend={t("goals.form.targetLevelLabel")}
          name="targetLevel"
          options={chipOptions(GOAL_KEY_PREFIXES.targetLevel, TARGET_LEVEL_OPTIONS, t)}
          value={watch("targetLevel")}
          onChange={(value) => setValue("targetLevel", value, { shouldValidate: true })}
          error={errorFor("targetLevel")}
          disabled={isSubmitting}
        />
      </div>

      {/* F/G — Timeframe & weekly commitment */}
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <ChoiceChips
            legend={t("goals.form.timeframeLabel")}
            name="timeframePreset"
            options={chipOptions(GOAL_KEY_PREFIXES.timeframe, TIMEFRAME_OPTIONS, t)}
            value={timeframePreset}
            onChange={(value) => setValue("timeframePreset", value, { shouldValidate: true })}
            error={errorFor("timeframePreset")}
            disabled={isSubmitting}
          />
          {timeframePreset === "custom" && (
            <InputField
              label={t("goals.form.customWeeksLabel")}
              type="number"
              min={1}
              max={104}
              inputMode="numeric"
              className="max-w-32"
              error={errorFor("customWeeks")}
              disabled={isSubmitting}
              {...register("customWeeks")}
            />
          )}
        </div>
        <div className="flex flex-col gap-3">
          <ChoiceChips
            legend={t("goals.form.commitmentLabel")}
            name="commitmentPreset"
            options={chipOptions(GOAL_KEY_PREFIXES.commitment, COMMITMENT_OPTIONS, t)}
            value={commitmentPreset}
            onChange={(value) => setValue("commitmentPreset", value, { shouldValidate: true })}
            error={errorFor("commitmentPreset")}
            disabled={isSubmitting}
          />
          {commitmentPreset === "custom" && (
            <InputField
              label={t("goals.form.customHoursLabel")}
              type="number"
              min={1}
              max={80}
              inputMode="numeric"
              className="max-w-32"
              error={errorFor("customHours")}
              disabled={isSubmitting}
              {...register("customHours")}
            />
          )}
        </div>
      </div>

      {/* H — Constraints (optional) */}
      <ToggleChips
        legend={t("goals.form.constraintsLabel")}
        options={chipOptions(GOAL_KEY_PREFIXES.constraint, CONSTRAINT_OPTIONS, t)}
        values={constraints}
        onToggle={(value) => {
          const next = constraints.includes(value)
            ? constraints.filter((entry) => entry !== value)
            : [...constraints, value];
          setValue("constraints", next);
        }}
        disabled={isSubmitting}
      />

      {/* Success criteria — engine-drafted, student-editable (edit mode) */}
      {mode === "edit" && (
        <fieldset className="flex flex-col gap-3" disabled={isSubmitting}>
          <legend className="text-sm font-medium text-foreground">
            {t("goals.form.criteriaLabel")}
          </legend>
          <p className="text-xs text-muted-foreground">{t("goals.form.criteriaHint")}</p>
          <ul className="flex flex-col gap-2">
            {fields.map((field, index) => (
              <li key={field.id} className="flex items-start gap-2">
                <div className="flex-1">
                  <TextAreaField
                    label={t("goals.form.criterionLabel", { n: index + 1 })}
                    hideLabel
                    rows={2}
                    placeholder={t("goals.form.criterionPlaceholder")}
                    error={
                      errors.successCriteria?.[index]?.text?.message
                        ? resolveZodMessage(errors.successCriteria[index]?.text?.message ?? "", t)
                        : null
                    }
                    {...register(`successCriteria.${index}.text`)}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("goals.form.removeCriterion")}
                  onClick={() => remove(index)}
                  className="mt-1 shrink-0"
                >
                  <X aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ul>
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={() => append({ text: "" })}>
              <Plus aria-hidden="true" />
              {t("goals.form.addCriterion")}
            </Button>
          </div>
          {errorFor("successCriteria") && (
            <p role="alert" className="text-xs font-medium text-danger-foreground">
              {errorFor("successCriteria")}
            </p>
          )}
        </fieldset>
      )}

      {/* Submission failure — user input is preserved, retry is safe (§13/§20) */}
      {submitError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-danger/40 bg-danger/5 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger-foreground" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium text-foreground">
                {t("goals.errors.saveFailedTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {submitError.retryable
                  ? t("goals.errors.saveFailedBody")
                  : t(submitError.messageKey)}
              </p>
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
              {t("common.retry")}
            </Button>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {mode === "create" ? t("goals.form.submit") : t("goals.form.saveChanges")}
        </Button>
      </div>
    </form>
  );
}
