/**
 * Evidence — the intelligence substrate.
 *
 * One row per observable learner action that proves (or fails to prove)
 * something. Immutable after evaluation where appropriate; versioned where
 * revision matters. Every row is student-owned, validated, timestamped,
 * traceable and concept-linked when possible.
 */

export const EVIDENCE_KINDS = [
  "answer",
  "reasoning",
  "solution",
  "code",
  "explanation",
  "quiz_result",
  "recall_result",
  "transfer_result",
  "hint_usage",
] as const;

export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export interface EvidencePayload {
  answer?: string;
  reasoning?: string;
  solution?: string;
  code?: string;
  explanation?: string;
  quizResult?: { score: number; correct: number; total: number };
  recallResult?: { confidence: string; intervalDays: number };
  transferResult?: { taskId: string; passed: boolean };
  hintUsage?: { count: number; durationSeconds: number };
  [key: string]: unknown;
}

export interface Evidence {
  id: string;
  studentId: string;
  conceptId: string | null;
  kind: EvidenceKind;
  payload: EvidencePayload;
  score: number | null; // 0..1
  timeSpentSeconds: number | null;
  attemptCount: number;
  hintUsed: boolean;
  hintCount: number;
  learningUnitId: string | null;
  roadmapId: string | null;
  assessmentSessionId: string | null;
  testAttemptId: string | null;
  immutable: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEvidenceInput {
  conceptId?: string | null;
  kind: EvidenceKind;
  payload: EvidencePayload;
  score?: number | null;
  timeSpentSeconds?: number | null;
  attemptCount?: number;
  hintUsed?: boolean;
  hintCount?: number;
  learningUnitId?: string | null;
  roadmapId?: string | null;
  assessmentSessionId?: string | null;
  testAttemptId?: string | null;
}

export const EVIDENCE_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "evidence_not_found",
  "invalid_evidence",
  "immutable_evidence",
  "network",
  "unknown",
] as const;

export type EvidenceErrorCode = (typeof EVIDENCE_ERROR_CODES)[number];
