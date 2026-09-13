"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState, type ReactNode } from "react";
import { ErrorState } from "@/components/feedback/states";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useLatestAssessmentResult } from "@/features/assessment/hooks/use-assessment";
import { DiagnosisIntro } from "@/features/goals/components/diagnosis-intro";
import { GoalForm } from "@/features/goals/components/goal-form";
import { GoalRefinement } from "@/features/goals/components/goal-refinement";
import { GoalReview } from "@/features/goals/components/goal-review";
import { GoalSteps, type GoalStepId } from "@/features/goals/components/goal-steps";
import { LockedGoalView } from "@/features/goals/components/locked-goal-view";
import { suggestedCurrentLevel } from "@/features/goals/constants/goal-discovery.constants";
import {
  useActiveDiscoveryGoal,
  useCreateDiscoveryGoal,
  useLockDiscoveryGoal,
  useReviseDiscoveryGoal,
  useUpdateDiscoveryGoal,
} from "@/features/goals/hooks/use-goal-discovery";
import { normalizeGoalError } from "@/features/goals/lib/errors";
import { createIdempotencyKey } from "@/features/goals/lib/idempotency";
import { patchForSuggestion } from "@/features/goals/lib/suggestions";
import { useT } from "@/lib/i18n/provider";
import { emptyGoalFormValues } from "@/schemas/goal";
import type { GoalDiscoveryInput, GoalSuggestion, LearningGoal } from "@/types/goal";

type ViewId = "intro" | "discover" | "refine" | "review" | "locked";

/**
 * Goal discovery orchestrator (§6–§15): a single `/goals` route whose
 * visible step is derived from the persisted goal status, so refreshes and
 * deep links always resume where the student left off. All business
 * decisions live in the engine; this component only routes views, owns
 * idempotency keys, and surfaces async states.
 */
export function GoalDiscoveryFlow() {
  const t = useT();
  const goalQuery = useActiveDiscoveryGoal();
  const diagnosisQuery = useLatestAssessmentResult();
  const createGoal = useCreateDiscoveryGoal();
  const updateGoal = useUpdateDiscoveryGoal();
  const lockGoal = useLockDiscoveryGoal();
  const reviseGoal = useReviseDiscoveryGoal();

  // "Start" from the intro, and "Edit" from the review, are local UI state;
  // everything else derives from the engine-owned goal status.
  const [started, setStarted] = useState(false);
  const [editingFromReview, setEditingFromReview] = useState(false);

  // One key per user intent — reused across retries so double clicks and
  // failed saves can never duplicate goals, transitions, or events (§14).
  const createKeyRef = useRef<string | null>(null);
  const lockKeyRef = useRef<string | null>(null);
  const pendingCreateRef = useRef<{ input: GoalDiscoveryInput; idempotencyKey: string } | null>(
    null,
  );
  const pendingLockRef = useRef<{ goalId: string; idempotencyKey: string } | null>(null);

  const goal = goalQuery.data ?? null;

  const submitCreate = (input: GoalDiscoveryInput) => {
    const idempotencyKey =
      createKeyRef.current ?? (createKeyRef.current = createIdempotencyKey("goal.create"));
    const vars = { input, idempotencyKey };
    pendingCreateRef.current = vars;
    createGoal.mutate(vars);
  };

  const retryCreate = () => {
    if (pendingCreateRef.current) createGoal.mutate(pendingCreateRef.current);
  };

  const submitUpdate = (target: LearningGoal, input: GoalDiscoveryInput) => {
    updateGoal.mutate(
      { goalId: target.id, patch: input },
      { onSuccess: () => setEditingFromReview(false) },
    );
  };

  const retryUpdate = () => {
    if (updateGoal.variables) {
      updateGoal.mutate(updateGoal.variables, {
        onSuccess: () => setEditingFromReview(false),
      });
    }
  };

  const applySuggestion = (target: LearningGoal, suggestion: GoalSuggestion) => {
    const patch = patchForSuggestion(suggestion);
    if (!patch) return;
    updateGoal.mutate(
      { goalId: target.id, patch },
      { onSuccess: () => setEditingFromReview(false) },
    );
  };

  const submitLock = (target: LearningGoal) => {
    const idempotencyKey =
      lockKeyRef.current ?? (lockKeyRef.current = createIdempotencyKey("goal.lock"));
    const vars = { goalId: target.id, idempotencyKey };
    pendingLockRef.current = vars;
    lockGoal.mutate(vars, {
      onSuccess: () => {
        lockKeyRef.current = null;
        pendingLockRef.current = null;
      },
    });
  };

  const retryLock = () => {
    if (pendingLockRef.current) lockGoal.mutate(pendingLockRef.current);
  };

  if (goalQuery.isPending) return <PageSkeleton blocks={2} />;

  if (goalQuery.isError) {
    const error = normalizeGoalError(goalQuery.error);
    return (
      <ErrorState
        title={t("goals.loadError.title")}
        body={t(error.messageKey)}
        onRetry={error.retryable ? () => goalQuery.refetch() : undefined}
      />
    );
  }

  const showReview = goal?.status === "validated" && !editingFromReview;
  const showRefine =
    goal !== null && goal.status !== "locked" && !(goal.status === "validated" && !editingFromReview);
  const showLocked = goal?.status === "locked";
  const showCreate = goal === null && started;

  const view: ViewId = showLocked
    ? "locked"
    : showReview
      ? "review"
      : showRefine
        ? "refine"
        : showCreate
          ? "discover"
          : "intro";

  const step: GoalStepId =
    view === "locked" ? "committed" : view === "review" ? "review" : view === "refine" ? "refine" : "discover";

  const diagnosis = diagnosisQuery.data ?? null;

  let content: ReactNode;
  switch (view) {
    case "intro":
      content = (
        <DiagnosisIntro
          diagnosis={diagnosis}
          diagnosisLoading={diagnosisQuery.isPending}
          onStart={() => setStarted(true)}
        />
      );
      break;
    case "discover": {
      const prefill = suggestedCurrentLevel(diagnosis);
      content = (
        <GoalForm
          mode="create"
          defaultValues={emptyGoalFormValues(prefill)}
          diagnosisPrefill={prefill}
          isSubmitting={createGoal.isPending}
          submitError={createGoal.isError ? normalizeGoalError(createGoal.error) : null}
          onRetrySubmit={retryCreate}
          onSubmitInput={submitCreate}
        />
      );
      break;
    }
    case "refine":
      content = goal && (
        <GoalRefinement
          goal={goal}
          isSaving={updateGoal.isPending}
          saveError={updateGoal.isError ? normalizeGoalError(updateGoal.error) : null}
          onRetrySave={retryUpdate}
          onSave={(input) => submitUpdate(goal, input)}
          onApplySuggestion={(suggestion) => applySuggestion(goal, suggestion)}
        />
      );
      break;
    case "review":
      content = goal && (
        <GoalReview
          goal={goal}
          onEdit={() => setEditingFromReview(true)}
          onLock={() => submitLock(goal)}
          isLocking={lockGoal.isPending}
          lockError={lockGoal.isError ? normalizeGoalError(lockGoal.error) : null}
          onRetryLock={retryLock}
        />
      );
      break;
    case "locked":
      content = goal && (
        <LockedGoalView goal={goal} onRevise={() => reviseGoal.mutate(goal.id)} isRevising={reviseGoal.isPending} />
      );
      break;
  }

  return (
    <div className="flex flex-col gap-10">
      {view !== "intro" && <GoalSteps current={step} />}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
