/**
 * Adaptive Learning — deterministic policy over real learner state.
 *
 * The engine reads Goal, Roadmap, ConceptStates, Diagnosis and history,
 * then emits a NextLearningAction. The LLM is never the authority —
 * it only verbalizes what the policy already decided.
 */

export const ADAPTIVE_ACTIONS = [
  "RETRIEVE",
  "EXPLAIN",
  "PRACTICE",
  "TRANSFER",
  "REVIEW",
  "REMEDIATE",
  "ADVANCE",
  "REST",
] as const;

export type AdaptiveAction = (typeof ADAPTIVE_ACTIONS)[number];

export interface DiagnosisInput {
  conceptId: string;
  strength: boolean;
  weakness: boolean;
  misconception: boolean;
  retrievalGap: boolean;
  retentionGap: boolean;
  transferGap: boolean;
  fluencyGap: boolean;
  confidenceMismatch: boolean;
  hintDependency: boolean;
  prerequisiteGap: boolean;
}

export interface AdaptiveInput {
  studentId: string;
  goalId: string | null;
  roadmapId: string | null;
  currentUnitId: string | null;
  conceptStates: import("./concept-state").ConceptState[];
  diagnoses: DiagnosisInput[];
  recentEvidenceCount: number;
  hasActiveRecovery: boolean;
  streakDays: number;
}

export interface NextLearningAction {
  action: AdaptiveAction;
  conceptId: string | null;
  unitId: string | null;
  reason: string; // human-readable "why this action" — transparent
  priority: number; // 0..100, higher first
  metadata: Record<string, unknown>;
}

export interface AdaptiveDecision {
  primary: NextLearningAction;
  alternatives: NextLearningAction[];
  evaluatedAt: string;
}

export const ADAPTIVE_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "no_roadmap",
  "no_concepts",
  "network",
  "unknown",
] as const;

export type AdaptiveErrorCode = (typeof ADAPTIVE_ERROR_CODES)[number];
