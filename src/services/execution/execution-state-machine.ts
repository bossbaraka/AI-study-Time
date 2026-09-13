/**
 * Execution state machine (Phase 7, §11) — the only authority on
 * learning-unit execution status.
 *
 *   available → in_progress → submitted → evaluated → { passed | needs_review | failed }
 *
 * `evaluated` carries a result; the result decides what happens next:
 *   - passed               → terminal (never reopens)
 *   - needs_review / failed → one explicit retry edge back to in_progress
 *
 * Everything else (passed → in_progress, available → submitted,
 * evaluated → submitted, …) is rejected with a typed error.
 * Same conventions as `roadmap-state-machine.ts` — no duplicated
 * generic infrastructure, just the domain's own transition table.
 */

import type { LearningResult, LearningUnitExecutionStatus } from "@/types/execution";

/** Minimal state the machine needs: status, plus result once evaluated. */
export interface ExecutionSnapshot {
  status: LearningUnitExecutionStatus;
  result?: LearningResult;
}

const TRANSITIONS: Readonly<
  Record<LearningUnitExecutionStatus, readonly LearningUnitExecutionStatus[]>
> = {
  available: ["in_progress"],
  in_progress: ["submitted"],
  submitted: ["evaluated"],
  // Retry edge — only valid for needs_review / failed (checked below).
  evaluated: ["in_progress"],
};

export class InvalidExecutionTransitionError extends Error {
  constructor(
    readonly from: LearningUnitExecutionStatus,
    readonly to: LearningUnitExecutionStatus,
    readonly result?: LearningResult,
  ) {
    super(`Invalid execution transition: ${from} → ${to}`);
    this.name = "InvalidExecutionTransitionError";
  }
}

export function canTransition(from: ExecutionSnapshot, to: LearningUnitExecutionStatus): boolean {
  if (from.status === to) return false; // no-op "transitions" are not transitions
  if (!TRANSITIONS[from.status].includes(to)) return false;
  if (from.status === "evaluated" && to === "in_progress") {
    // A passed unit is done — it never reopens. Only unfinished results
    // get the explicit retry edge (§10: the unit "remains relevant").
    return from.result === "needs_review" || from.result === "failed";
  }
  return true;
}

export function assertTransition(from: ExecutionSnapshot, to: LearningUnitExecutionStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidExecutionTransitionError(from.status, to, from.result);
  }
}

/** Terminal = evaluated AND passed. needs_review / failed can retry. */
export function isTerminal(snapshot: ExecutionSnapshot): boolean {
  return snapshot.status === "evaluated" && snapshot.result === "passed";
}
