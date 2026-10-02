/**
 * Recall — evidence-driven scheduling.
 *
 * Each concept that has been studied has one schedule row that tells
 * the system when to ask again. Not a self-rated confidence multiplier
 * alone — performance on recall shapes the interval.
 */

export const RECALL_STATES = ["new", "learning", "review", "relearning"] as const;
export type RecallState = (typeof RECALL_STATES)[number];

export interface RecallSchedule {
  id: string;
  studentId: string;
  conceptId: string;
  evidenceId: string | null;
  intervalDays: number;
  easeFactor: number; // 1.3..2.5+
  repetitions: number;
  dueAt: string; // ISO
  lastReviewedAt: string | null;
  state: RecallState;
  createdAt: string;
  updatedAt: string;
}

export interface RecallReviewInput {
  conceptId: string;
  quality: number; // 0..5 (0=blackout, 5=perfect) — mapped from correctness + confidence
  timeSpentSeconds?: number;
}

export interface RecallReviewResult {
  schedule: RecallSchedule;
  nextDueAt: string;
  wasCorrect: boolean;
}

export const RECALL_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "schedule_not_found",
  "invalid_review",
  "network",
  "unknown",
] as const;

export type RecallErrorCode = (typeof RECALL_ERROR_CODES)[number];
