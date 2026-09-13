/**
 * Learning execution domain model (Phase 7).
 *
 * Execution is RUNTIME state layered over the Stage 6 Roadmap contract:
 *
 *   Roadmap (plan, immutable during execution)
 *     └── Milestone
 *          └── LearningUnit ── LearningUnitExecution (runtime)
 *
 * Lifecycle:  available → in_progress → submitted → evaluated
 * Result:     passed | needs_review | failed
 *
 * The curriculum is never mutated here — milestone/roadmap completion
 * semantics belong to the roadmap domain, not to execution.
 */

import type { LearningUnit, RoadmapStatus } from "@/types/roadmap";

/* ------------------------------------------------------------------ */
/* Statuses & results                                                  */
/* ------------------------------------------------------------------ */

export const EXECUTION_STATUSES = [
  "available",
  "in_progress",
  "submitted",
  "evaluated",
] as const;

export type LearningUnitExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export const LEARNING_RESULTS = ["passed", "needs_review", "failed"] as const;

export type LearningResult = (typeof LEARNING_RESULTS)[number];

/* ------------------------------------------------------------------ */
/* Evidence                                                            */
/* ------------------------------------------------------------------ */

/**
 * Observable, text-based evidence (Phase 7 scope). `kind` keeps the
 * model extensible for future evidence types (files, repos, video)
 * without changing consumers.
 */
export interface LearningEvidence {
  kind: "text";
  /** The student's own solution / artefact description. */
  solution: string;
  /** Why it works — the student's reasoning in their own words. */
  reasoning: string;
  submittedAt: string;
}

/** Client-submitted evidence payload (timestamps are server-set). */
export interface EvidenceInput {
  solution: string;
  reasoning: string;
}

/* ------------------------------------------------------------------ */
/* Execution record                                                    */
/* ------------------------------------------------------------------ */

export interface LearningUnitExecution {
  id: string;
  /** Always resolved from the session — never client input. */
  studentId: string;
  roadmapId: string;
  milestoneId: string;
  learningUnitId: string;
  status: LearningUnitExecutionStatus;
  startedAt?: string;
  submittedAt?: string;
  evaluatedAt?: string;
  evidence?: LearningEvidence;
  result?: LearningResult;
}

/* ------------------------------------------------------------------ */
/* Derived views (honest states only — no invented percentages, §13)   */
/* ------------------------------------------------------------------ */

export const DERIVED_UNIT_STATUSES = [
  "blocked",
  "available",
  "in_progress",
  "submitted",
  "passed",
  "needs_review",
  "failed",
] as const;

/**
 * Per-unit state as the product speaks it: a merge of the execution
 * record (when one exists) and the roadmap dependency graph (when not).
 */
export type DerivedUnitStatus = (typeof DERIVED_UNIT_STATUSES)[number];

/** Lightweight unit reference used for "current" / "next" pointers. */
export interface UnitRef {
  id: string;
  title: string;
  milestoneId: string;
  milestoneTitle: string;
}

/** Runtime execution view over the student's active roadmap. */
export interface RoadmapExecutionView {
  roadmapId: string;
  roadmapStatus: RoadmapStatus;
  /** Derived status for every unit id in the roadmap. */
  unitStates: Record<string, DerivedUnitStatus>;
  /** The one unit the student should act on now (null when all passed). */
  currentUnit: UnitRef | null;
  /** True when every learning unit has a passed execution. */
  allUnitsPassed: boolean;
}

/** Everything the learn screen needs for one unit — resolved server-side. */
export interface UnitLearningContext {
  roadmap: { id: string; title: string; status: RoadmapStatus };
  milestone: {
    id: string;
    title: string;
    order: number;
    learningOutcome: string;
  };
  unit: LearningUnit;
  /** Null until the student starts the unit. */
  execution: LearningUnitExecution | null;
  status: DerivedUnitStatus;
  /** The unit that opens up once THIS one passes — "what happens next". */
  nextUnit: UnitRef | null;
  allUnitsPassed: boolean;
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export const EXECUTION_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "execution_not_found",
  "invalid_transition",
  "unit_unavailable",
  "evidence_invalid",
  "conflict",
  "network",
  "unknown",
] as const;

export type ExecutionErrorCode = (typeof EXECUTION_ERROR_CODES)[number];

export function isExecutionErrorCode(code: string | undefined): code is ExecutionErrorCode {
  return code !== undefined && (EXECUTION_ERROR_CODES as readonly string[]).includes(code);
}
