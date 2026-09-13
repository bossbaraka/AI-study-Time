/**
 * Roadmap domain model (Phase 6).
 *
 * A Roadmap is a structured learning strategy — not a task list. It
 * transforms the student's LockedGoal (+ the diagnosis it carries) into
 * ordered Milestones, each built from LearningUnits and sealed by a
 * capability Checkpoint.
 *
 * This model is the Phase 7 hand-off contract:
 *   LockedGoal → Roadmap → Milestone → LearningUnit → Checkpoint
 *
 * NOTE: `types/domain.ts` still carries the Phase-1 dashboard mock
 * (`RoadmapPhase`/`RoadmapModule`). This file is the authoritative
 * roadmap domain; the legacy mock remains only as dashboard filler for
 * later phases and never crosses into the roadmap engine.
 */

/* ------------------------------------------------------------------ */
/* Statuses                                                            */
/* ------------------------------------------------------------------ */

export const ROADMAP_STATUSES = [
  "draft",
  "active",
  "paused",
  "revised",
  "completed",
  "abandoned",
] as const;

export type RoadmapStatus = (typeof ROADMAP_STATUSES)[number];

export const MILESTONE_STATUSES = ["pending", "in_progress", "completed"] as const;

export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

/* ------------------------------------------------------------------ */
/* Learning units                                                      */
/* ------------------------------------------------------------------ */

export const LEARNING_UNIT_TYPES = [
  "learn",
  "practice",
  "build",
  "review",
  "reflect",
  "assess",
] as const;

export type LearningUnitType = (typeof LEARNING_UNIT_TYPES)[number];

/**
 * The atomic educational component inside a milestone. Every unit answers:
 * what am I doing, why, which capability does it develop, how long, and
 * what evidence shows completion.
 */
export interface LearningUnit {
  id: string;
  milestoneId: string;
  type: LearningUnitType;
  /** Order within the milestone (0-based). */
  order: number;
  title: string;
  /** Why this unit exists — links back to the capability it develops. */
  purpose: string;
  estimatedMinutes: number;
  expectedOutcome: string;
  /** Observable evidence that the unit is done (Phase 7 consumes this). */
  completionEvidence: string;
}

/* ------------------------------------------------------------------ */
/* Checkpoints                                                         */
/* ------------------------------------------------------------------ */

export const CHECKPOINT_TYPES = [
  /** Explain the concept in your own words. */
  "explain",
  /** Solve a new problem without following a tutorial. */
  "solve_new_problem",
  /** Build a small feature independently. */
  "build_feature",
  /** Debug an unfamiliar implementation. */
  "debug_unfamiliar",
  /** Pass a short diagnostic assessment. */
  "diagnostic_quiz",
  /** Complete a practical project. */
  "practical_project",
] as const;

export type CheckpointType = (typeof CHECKPOINT_TYPES)[number];

/**
 * A checkpoint evaluates capability — never "did you finish?".
 * Ready-to-continue signals live here (Phase 7 consumes this).
 */
export interface Checkpoint {
  id: string;
  milestoneId: string;
  type: CheckpointType;
  title: string;
  description: string;
  /** What the student can observe when they are ready to continue. */
  successSignal: string;
}

/* ------------------------------------------------------------------ */
/* Milestones & dependencies                                           */
/* ------------------------------------------------------------------ */

export interface Milestone {
  id: string;
  roadmapId: string;
  /** Curriculum capability this milestone develops (goal-alignment trace). */
  capabilityId: string;
  title: string;
  description: string;
  /** 0-based position in the roadmap. */
  order: number;
  status: MilestoneStatus;
  /** The capability change this milestone represents. */
  learningOutcome: string;
  estimatedHours: number;
  /** Ids of milestones that must come first (prerequisite closure). */
  dependencies: string[];
  learningUnits: LearningUnit[];
  checkpoint: Checkpoint;
  /** Why this milestone exists for THIS locked goal — explainability (§14). */
  goalAlignment: string;
  /** True when the milestone primarily preserves an assessed strength. */
  maintenance: boolean;
}

/** One explicit prerequisite edge in the roadmap graph. */
export interface Dependency {
  /** The milestone that depends. */
  milestoneId: string;
  /** The prerequisite milestone. */
  requiresMilestoneId: string;
}

/* ------------------------------------------------------------------ */
/* Roadmap                                                             */
/* ------------------------------------------------------------------ */

export const TIME_FEASIBILITY = ["fits", "tight", "exceeds"] as const;

/** Honest qualitative budget verdict — never a fabricated percentage. */
export type TimeFeasibility = (typeof TIME_FEASIBILITY)[number];

export interface EstimatedDuration {
  value: number;
  unit: "weeks" | "months";
}

export interface RoadmapGenerationContext {
  /** Goal version at generation time — roadmaps are versioned against it. */
  goalVersion: number;
  /** Deterministic engine identity: same engine + input ⇒ same roadmap. */
  engineVersion: string;
  /** Assessment session the diagnosis came from, when present. */
  diagnosisSessionId?: string;
  /** studentId:goalId:goalVersion:engineVersion — idempotency anchor. */
  generationKey: string;
  /** Total hours the goal makes available (weeks × hours/week). */
  availableHours: number;
  /** Natural (unscaled) effort the selected path would need. */
  requiredHours: number;
}

export interface Roadmap {
  id: string;
  studentId: string;
  goalId: string;
  /** Incremented per regeneration after a goal revision; history is kept. */
  version: number;
  status: RoadmapStatus;
  title: string;
  description: string;
  estimatedDuration: EstimatedDuration;
  /** Hours per week the student committed to in the locked goal. */
  weeklyCommitment: number;
  totalEstimatedHours: number;
  timeFeasibility: TimeFeasibility;
  milestones: Milestone[];
  generationContext: RoadmapGenerationContext;
  createdAt: string;
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Generation                                                          */
/* ------------------------------------------------------------------ */

/** Client-supplied request: the goal only — identity comes from the session. */
export interface RoadmapGenerationRequest {
  goalId: string;
}

export interface RoadmapGenerationResult {
  roadmap: Roadmap;
  /** False when an identical generation was replayed (idempotent hit). */
  created: boolean;
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export const ROADMAP_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "roadmap_not_found",
  "invalid_transition",
  "no_locked_goal",
  "infeasible_timeframe",
  "generation_failed",
  "network",
  "unknown",
] as const;

export type RoadmapErrorCode = (typeof ROADMAP_ERROR_CODES)[number];

export function isRoadmapErrorCode(code: string | undefined): code is RoadmapErrorCode {
  return code !== undefined && (ROADMAP_ERROR_CODES as readonly string[]).includes(code);
}
