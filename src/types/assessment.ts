/**
 * STEP 4 — Adaptive assessment domain model.
 *
 * The frontend presents, collects and renders. Question selection,
 * evaluation, adaptation and diagnosis are the assessment engine's job
 * (mocked in `services/assessment/`, later the real AI backend). These
 * types are the contract at that boundary — the UI never needs to change
 * when the mock engine is swapped for the real one.
 */

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

export type AssessmentStatus =
  | "not_started"
  | "in_progress"
  | "paused"
  | "completed"
  | "expired";

export type EducationalStage =
  | "elementary"
  | "middle"
  | "high_school"
  | "university"
  | "professional";

export interface StudentAssessmentProfile {
  targetSubject: string;
  age: number;
  stage: EducationalStage;
}

/** Topics the diagnostic bank currently covers (backend-owned taxonomy). */
export type AssessmentTopicId =
  | "functions"
  | "scope"
  | "closures"
  | "arrays"
  | "async"
  | (string & {});

export type AssessmentDifficulty = "foundational" | "intermediate" | "advanced";

/**
 * Honest progress: the adaptive engine does not know the final question
 * count, so it reports what it *does* know — questions explored, topics
 * touched and an estimated remaining time / completion band.
 */
export interface AssessmentProgress {
  questionsAnswered: number;
  topicsExplored: number;
  totalTopics: number;
  /** Engine estimate of minutes remaining; rounded, never second-precise. */
  estimatedMinutesRemaining: number;
  /**
   * Engine estimate of overall completion, 0–100, clamped below 100 until
   * the session actually completes. Presented as approximate — never as
   * "question 17 of 30".
   */
  estimatedCompletionPercent: number;
}

/** Subtle transition hint shown between questions. Never exposes reasoning. */
export type AdaptationNote = "deepening" | "adjusting" | "moving_on";

export interface AssessmentSession {
  id: string;
  status: AssessmentStatus;
  startedAt: string;
  estimatedDurationMinutes: number;
  /** Present while the engine still has a question to ask. */
  currentQuestion: AssessmentQuestion | null;
  progress: AssessmentProgress;
  /** Profile of the student provided before generating questions */
  profile?: StudentAssessmentProfile;
  /** Set on the transition that produced `currentQuestion`. */
  adaptationNote?: AdaptationNote;
  /** Idempotency key of the last accepted submission (retry safety). */
  lastSubmissionId?: string;
}

/* ------------------------------------------------------------------ */
/* Questions                                                           */
/* ------------------------------------------------------------------ */

export type AssessmentQuestionType =
  | "multiple_choice"
  | "short_answer"
  | "scenario"
  | "problem_solving";

export interface AssessmentOption {
  id: string;
  label: string;
}

export interface AssessmentQuestion {
  id: string;
  type: AssessmentQuestionType;
  /** Backend-owned content (like all mock data, English in the mock bank). */
  prompt: string;
  instructions?: string;
  /** Scenario context paragraph, rendered before the question. */
  context?: string;
  options?: AssessmentOption[];
  topic: AssessmentTopicId;
  difficulty: AssessmentDifficulty;
  estimatedSeconds: number;
}

/* ------------------------------------------------------------------ */
/* Responses                                                           */
/* ------------------------------------------------------------------ */

/**
 * Discriminated union — one typed shape per question type.
 * Never a giant untyped answer object.
 */
export type AssessmentResponse =
  | { type: "multiple_choice"; questionId: string; optionId: string }
  | { type: "short_answer"; questionId: string; answer: string }
  | { type: "scenario"; questionId: string; optionId: string; reasoning?: string }
  | { type: "problem_solving"; questionId: string; answer: string };

export interface SubmitAnswerPayload {
  sessionId: string;
  response: AssessmentResponse;
  /**
   * Client-generated idempotency key. Retries of the same submission reuse
   * it so a flaky network never double-counts an answer.
   */
  submissionId: string;
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

/**
 * Qualitative insight codes. The UI maps them to translation keys —
 * supportive, educational language (§22/§23) is enforced in one place.
 */
export type InsightCode =
  | "strong_conceptual"
  | "strong_applied"
  | "fundamentals_need_practice"
  | "conceptual_gap"
  | "not_yet_demonstrated";

export interface LearningInsight {
  topic: AssessmentTopicId;
  insight: InsightCode;
  /** How many responses informed this insight — no false precision beyond it. */
  basedOnResponses: number;
}

export interface RecommendedStartingPoint {
  topic: AssessmentTopicId;
  level: AssessmentDifficulty;
}

export type DiagnosticConfidence = "low" | "medium" | "high";

export interface AssessmentResult {
  sessionId: string;
  completedAt: string;
  questionsAnswered: number;
  strengths: LearningInsight[];
  developingAreas: LearningInsight[];
  knowledgeGaps: LearningInsight[];
  recommendedStartingPoint: RecommendedStartingPoint | null;
  /** Confidence in the *diagnosis*, not in the student. */
  confidence: DiagnosticConfidence;
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

export const ASSESSMENT_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "session_not_found",
  "session_not_active",
  "assessment_not_completed",
  "invalid_response",
  "network",
  "unknown",
] as const;

export type AssessmentErrorCode = (typeof ASSESSMENT_ERROR_CODES)[number];

export function isAssessmentErrorCode(value: unknown): value is AssessmentErrorCode {
  return typeof value === "string" && (ASSESSMENT_ERROR_CODES as readonly string[]).includes(value);
}
