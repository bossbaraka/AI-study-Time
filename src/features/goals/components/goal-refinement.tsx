"use client";

import { GoalForm } from "@/features/goals/components/goal-form";
import { ValidationIssues } from "@/features/goals/components/validation-issues";
import type { NormalizedGoalError } from "@/features/goals/lib/errors";
import { useT } from "@/lib/i18n/provider";
import { goalToFormValues } from "@/schemas/goal";
import type { GoalDiscoveryInput, GoalSuggestion, LearningGoal } from "@/types/goal";

export interface GoalRefinementProps {
  goal: LearningGoal;
  isSaving: boolean;
  saveError: NormalizedGoalError | null;
  onRetrySave: () => void;
  /** Student-saved edits (engine re-validates and returns the new verdict). */
  onSave: (input: GoalDiscoveryInput) => void;
  /** Explicit "use suggestion" — never applied automatically (§11). */
  onApplySuggestion: (suggestion: GoalSuggestion) => void;
}

/**
 * Refinement step: validation feedback + suggestions above an editable
 * copy of the goal. The student always stays in control — suggestions are
 * adopted with one click and remain editable afterwards.
 */
export function GoalRefinement({
  goal,
  isSaving,
  saveError,
  onRetrySave,
  onSave,
  onApplySuggestion,
}: GoalRefinementProps) {
  const t = useT();

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("goals.refine.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("goals.refine.subtitle")}</p>
      </header>

      {goal.validation && (
        <ValidationIssues
          validation={goal.validation}
          onApplySuggestion={onApplySuggestion}
          isApplying={isSaving}
        />
      )}

      {/* Remount on version change so applied suggestions/edits re-seed the form. */}
      <GoalForm
        key={goal.version}
        mode="edit"
        defaultValues={goalToFormValues(goal)}
        isSubmitting={isSaving}
        submitError={saveError}
        onRetrySubmit={onRetrySave}
        onSubmitInput={onSave}
      />
    </div>
  );
}
