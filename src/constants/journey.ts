/**
 * The Mureeh journey model — the product's central spine.
 * Every surface in the app maps back to one of these stages.
 */
export const JOURNEY_STAGES = [
  "understand",
  "diagnose",
  "goal",
  "commit",
  "roadmap",
  "execute",
  "measure",
  "correct",
  "master",
  "achieve",
] as const;

export type JourneyStage = (typeof JOURNEY_STAGES)[number];

/** Visual states a roadmap phase can be in. */
export const PHASE_STATUSES = [
  "locked",
  "current",
  "completed",
  "delayed",
  "failed",
  "recovery",
  "mastered",
] as const;

export type PhaseStatus = (typeof PHASE_STATUSES)[number];

/** The daily execution loop shown on the dashboard and mission screen. */
export const DAILY_LOOP_STEPS = ["learn", "practice", "recall", "quiz"] as const;

export type DailyLoopStep = (typeof DAILY_LOOP_STEPS)[number];

/** Active recall modes. */
export const RECALL_MODES = [
  "flashcard",
  "explain",
  "multiple-choice",
  "short-answer",
  "scenario",
  "problem-solving",
] as const;

export type RecallMode = (typeof RECALL_MODES)[number];

/** Mastery evidence requirements — completion ≠ mastery. */
export const MASTERY_EVIDENCE = ["recall", "practice", "quiz", "module-test"] as const;

export type MasteryEvidenceKind = (typeof MASTERY_EVIDENCE)[number];

/** Minimum module-test score considered mastered (product rule, not UI magic number). */
export const MASTERY_TEST_THRESHOLD = 80;

/** Recovery pipeline steps. */
export const RECOVERY_STEPS = [
  "diagnosis",
  "review",
  "practice",
  "recall",
  "retest",
] as const;

export type RecoveryStep = (typeof RECOVERY_STEPS)[number];

/** Assessment / onboarding stage. */
export const ONBOARDING_STEPS = ["assessment", "goal-discovery", "commitment", "roadmap-approval"] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];
