/**
 * Server-authoritative Test — the browser never decides correctness.
 *
 * The client submits answers; the server grades against the rubric
 * and returns the verdict. The schema never accepts `correct: boolean`
 * or `score` from the client.
 */

export type TestQuestionKind = "multiple_choice" | "short_answer" | "scenario" | "problem_solving";

export interface TestQuestionDefinition {
  id: string;
  testId: string;
  kind: TestQuestionKind;
  prompt: string;
  choices?: string[];
  correctChoiceIndex?: number | null;
  explanation: string;
  topic: string;
  points: number;
  rubric?: unknown;
}

export interface TestDefinition {
  id: string;
  title: string;
  moduleId: string | null;
  phaseTitle: string | null;
  timeLimitMinutes: number | null;
  questions: TestQuestionDefinition[];
  createdAt: string;
  updatedAt: string;
}

export interface TestAnswerInput {
  questionId: string;
  // For multiple_choice / scenario
  choiceIndex?: number;
  // For short_answer / problem_solving
  answer?: string;
  reasoning?: string;
}

export interface TestAttempt {
  id: string;
  studentId: string;
  testId: string;
  status: string; // submitted | graded
  score: number; // 0..100
  timeSpentSeconds: number;
  answers: TestAnswerInput[];
  gradedAnswers: GradedAnswer[] | null;
  strongTopics: string[];
  needsReviewTopics: string[];
  recommendation: string | null; // continue | review-then-continue | recovery-session
  createdAt: string;
}

export interface GradedAnswer {
  questionId: string;
  givenChoiceIndex?: number;
  givenAnswer?: string;
  correct: boolean;
  pointsEarned: number;
  pointsPossible: number;
  feedback: string;
}

export const TEST_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "test_not_found",
  "attempt_not_found",
  "invalid_answers",
  "time_expired",
  "network",
  "unknown",
] as const;

export type TestErrorCode = (typeof TEST_ERROR_CODES)[number];

export function isTestErrorCode(code: string | undefined): code is TestErrorCode {
  return code !== undefined && (TEST_ERROR_CODES as readonly string[]).includes(code);
}
