/**
 * Typed execution errors (§19). Messages carry stable domain codes only —
 * never storage details or engine internals. The UI maps codes to
 * localized text in `features/execution/lib/errors.ts`.
 */

/** Unknown execution/unit — foreign and missing ids are indistinguishable. */
export class ExecutionNotFoundError extends Error {
  constructor(message = "execution_not_found") {
    super(message);
    this.name = "ExecutionNotFoundError";
  }
}

/** Cross-account access — existence of foreign resources is never leaked. */
export class ExecutionUnauthorizedError extends Error {
  constructor(
    readonly status: 403 | 404,
    readonly code: "forbidden" | "execution_not_found",
  ) {
    super(code);
    this.name = "ExecutionUnauthorizedError";
  }
}

export type UnitUnavailableReason =
  /** The student has no active roadmap to execute. */
  | "no_active_roadmap"
  /** The roadmap exists but is not executable (paused / superseded). */
  | "roadmap_not_executable"
  /** Prerequisites (milestone deps or earlier units) are not passed yet. */
  | "dependencies_unsatisfied";

/** The unit cannot be started right now — honest, non-leaking reasons. */
export class LearningUnitUnavailableError extends Error {
  constructor(readonly reason: UnitUnavailableReason) {
    super(`unit_unavailable:${reason}`);
    this.name = "LearningUnitUnavailableError";
  }
}

/** Submitted evidence does not meet the minimum contract. */
export class EvidenceInvalidError extends Error {
  constructor(message = "evidence_invalid") {
    super(message);
    this.name = "EvidenceInvalidError";
  }
}

/** A conflicting operation on the same execution (e.g. resubmit). */
export class ExecutionConflictError extends Error {
  constructor(message = "conflict") {
    super(message);
    this.name = "ExecutionConflictError";
  }
}
