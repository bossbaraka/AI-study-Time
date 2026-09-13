/**
 * STEP 5 — Goal Discovery domain model.
 *
 * A goal here is a validated, explicit, measurable learning direction —
 * not a task. The lifecycle is an explicit state machine (see
 * `services/goals/goal-state-machine.ts`); components can never mutate
 * status directly. The final artifact is the `LockedGoal` contract that
 * Phase 6 (Roadmap Generation) will consume.
 */

import type { AssessmentResult } from "@/types/assessment";

/* ------------------------------------------------------------------ */
/* State machine                                                       */
/* ------------------------------------------------------------------ */

export const GOAL_STATUSES = [
  "draft",
  "discovered",
  "refining",
  "validated",
  "locked",
  "active",
  "achieved",
  "paused",
  "abandoned",
  "revised",
] as const;

export type GoalStatus = (typeof GOAL_STATUSES)[number];

/* ------------------------------------------------------------------ */
/* Discovery inputs                                                    */
/* ------------------------------------------------------------------ */

export const GOAL_DOMAIN_PRESETS = [
  "javascript",
  "frontend",
  "backend",
  "software_engineering",
  "ai",
  "data_science",
  "cybersecurity",
  "english",
  "mathematics",
] as const;

export type GoalDomainPresetId = (typeof GOAL_DOMAIN_PRESETS)[number];

/** Preset id or a student-named custom domain. */
export type GoalDomain =
  | { kind: "preset"; presetId: GoalDomainPresetId }
  | { kind: "custom"; label: string };

export const CURRENT_LEVELS = [
  "new_to_it",
  "basic_familiarity",
  "developing",
  "comfortable",
  "advanced",
] as const;

export type CurrentLevel = (typeof CURRENT_LEVELS)[number];

export const TARGET_LEVELS = [
  "understand_fundamentals",
  "build_independently",
  "build_production_quality",
  "work_professionally",
  "teach_explain",
  "master_advanced",
] as const;

export type TargetLevel = (typeof TARGET_LEVELS)[number];

export const MOTIVATION_KINDS = [
  "career",
  "university",
  "project",
  "certification",
  "personal",
  "academic",
  "other",
] as const;

export type MotivationKind = (typeof MOTIVATION_KINDS)[number];

export interface GoalMotivation {
  kind: MotivationKind;
  /** Free-text explanation, required only for "other". */
  note?: string;
}

export const CONSTRAINT_KINDS = [
  "limited_daily_time",
  "university_workload",
  "work",
  "device_limitations",
  "internet_limitations",
  "language",
  "other",
] as const;

export type ConstraintKind = (typeof CONSTRAINT_KINDS)[number];

export interface GoalTimeframe {
  weeks: number;
  /** True when chosen from a preset (4/8/12/24/52), false for custom. */
  preset: boolean;
}

export interface GoalCommitment {
  hoursPerWeek: number;
  preset: boolean;
}

/* ------------------------------------------------------------------ */
/* The goal itself                                                     */
/* ------------------------------------------------------------------ */

/**
 * Snapshot of the Phase 4 diagnosis attached at creation time.
 * Stored so the goal remains self-contained after refresh — and so
 * Phase 6 never needs to re-query the assessment.
 */
export type GoalDiagnosisContext = Pick<
  AssessmentResult,
  | "sessionId"
  | "completedAt"
  | "questionsAnswered"
  | "strengths"
  | "developingAreas"
  | "knowledgeGaps"
  | "recommendedStartingPoint"
  | "confidence"
>;

export interface LearningGoal {
  id: string;
  /** Resolved server-side from the authenticated session — never client input. */
  studentId: string;
  status: GoalStatus;
  desiredOutcome: string;
  motivation: GoalMotivation;
  targetDomain: GoalDomain;
  currentLevel: CurrentLevel;
  targetLevel: TargetLevel;
  timeframe: GoalTimeframe;
  weeklyCommitment: GoalCommitment;
  constraints: ConstraintKind[];
  /** Engine-drafted, student-editable. Never auto-overwritten. */
  successCriteria: string[];
  diagnosisContext: GoalDiagnosisContext | null;
  /** Latest engine validation, persisted with the goal. */
  validation: GoalValidationResult | null;
  createdAt: string;
  updatedAt: string;
  lockedAt: string | null;
  /** Bumped on every accepted mutation; optimistic-concurrency ready. */
  version: number;
  /** Idempotency key of the accepted creation request. */
  createIdempotencyKey?: string;
  /** Idempotency key of the accepted lock request. */
  lockIdempotencyKey?: string;
  /** Set when this goal revises an earlier locked one. */
  revisesGoalId?: string;
}

/** Phase 6 hand-off contract: a goal that passed validate → lock. */
export type LockedGoal = LearningGoal & {
  status: "locked";
  lockedAt: string;
};

/* ------------------------------------------------------------------ */
/* Validation & quality (qualitative — no fake numeric precision)      */
/* ------------------------------------------------------------------ */

export const GOAL_ISSUE_CODES = [
  "outcome_missing",
  "outcome_vague",
  "topic_only",
  "domain_missing",
  "custom_domain_missing",
  "criteria_missing",
  "timeframe_missing",
  "commitment_missing",
  "unrealistic_timeframe",
  "timeline_aggressive",
  "commitment_insufficient",
  "not_measurable",
] as const;

export type GoalIssueCode = (typeof GOAL_ISSUE_CODES)[number];

export type GoalIssueSeverity = "error" | "warning";

export interface GoalValidationIssue {
  code: GoalIssueCode;
  severity: GoalIssueSeverity;
  /** Field the issue refers to, when applicable (focus/anchor target). */
  field?: "desiredOutcome" | "targetDomain" | "successCriteria" | "timeframe" | "weeklyCommitment";
}

export const GOAL_QUALITY_DIMENSIONS = [
  "clarity",
  "specificity",
  "measurability",
  "feasibility",
  "timeframe",
  "commitment",
  "alignment",
  "outcome",
] as const;

export type GoalQualityDimension = (typeof GOAL_QUALITY_DIMENSIONS)[number];

/** Qualitative verdicts only — never a fabricated percentage. */
export type GoalQualityVerdict = "strong" | "developing" | "weak";

export interface GoalDimensionQuality {
  dimension: GoalQualityDimension;
  verdict: GoalQualityVerdict;
}

export const GOAL_SUGGESTION_CODES = [
  "concrete_outcome",
  "measurable_outcome",
  "realistic_window",
  "draft_criteria",
] as const;

export type GoalSuggestionCode = (typeof GOAL_SUGGESTION_CODES)[number];

export interface GoalSuggestionPayload {
  /** Structured values behind `example`, so applying a suggestion is a
   *  typed patch — never text parsing in the UI. */
  outcome?: string;
  weeks?: number;
  criteria?: string[];
}

export interface GoalSuggestion {
  code: GoalSuggestionCode;
  /** Deterministic example text the student may adopt or ignore. */
  example: string;
  field: "desiredOutcome" | "timeframe" | "successCriteria";
  payload: GoalSuggestionPayload;
}

export type GoalOverallVerdict = "ready" | "needs_refinement" | "not_ready";

export interface GoalValidationResult {
  /** True when no `error`-severity issues remain. Warnings never block. */
  valid: boolean;
  issues: GoalValidationIssue[];
  quality: GoalDimensionQuality[];
  overall: GoalOverallVerdict;
  suggestions: GoalSuggestion[];
  evaluatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Service payloads                                                    */
/* ------------------------------------------------------------------ */

/** What the discovery form collects — no studentId (resolved server-side). */
export interface GoalDiscoveryInput {
  targetDomain: GoalDomain;
  desiredOutcome: string;
  motivation: GoalMotivation;
  currentLevel: CurrentLevel;
  targetLevel: TargetLevel;
  timeframe: GoalTimeframe;
  weeklyCommitment: GoalCommitment;
  constraints: ConstraintKind[];
  /** Optional student-provided criteria; the engine drafts when empty. */
  successCriteria?: string[];
}

/** Editable subset for the refinement step. */
export type GoalRefinePatch = Partial<
  Pick<
    GoalDiscoveryInput,
    | "targetDomain"
    | "desiredOutcome"
    | "motivation"
    | "currentLevel"
    | "targetLevel"
    | "timeframe"
    | "weeklyCommitment"
    | "constraints"
    | "successCriteria"
  >
>;

export interface GoalWithValidation {
  goal: LearningGoal;
  validation: GoalValidationResult;
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export const GOAL_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "goal_not_found",
  "invalid_transition",
  "validation_failed",
  "network",
  "unknown",
] as const;

export type GoalErrorCode = (typeof GOAL_ERROR_CODES)[number];

export function isGoalErrorCode(value: unknown): value is GoalErrorCode {
  return typeof value === "string" && (GOAL_ERROR_CODES as readonly string[]).includes(value);
}
