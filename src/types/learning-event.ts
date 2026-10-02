/**
 * Learning Event — append-only, student-owned, traceable.
 *
 * Every observable learning action emits one row here. The event log is
 * the source of truth that can rebuild learner state from evidence.
 */

export const LEARNING_EVENT_TYPES = [
  "SESSION_STARTED",
  "SESSION_ENDED",
  "ASSESSMENT_STARTED",
  "ASSESSMENT_COMPLETED",
  "QUESTION_ANSWERED",
  "GOAL_CREATED",
  "GOAL_LOCKED",
  "ROADMAP_GENERATED",
  "UNIT_STARTED",
  "UNIT_COMPLETED",
  "EVIDENCE_SUBMITTED",
  "EVALUATION_COMPLETED",
  "RECALL_SCHEDULED",
  "RECALL_COMPLETED",
  "RECALL_FAILED",
  "TEST_STARTED",
  "TEST_COMPLETED",
  "HINT_REQUESTED",
  "MISSION_SKIPPED",
  "MISSION_ABANDONED",
  "MENTOR_INTERACTION",
  "RECOVERY_STARTED",
  "RECOVERY_COMPLETED",
] as const;

export type LearningEventType = (typeof LEARNING_EVENT_TYPES)[number];

export interface LearningEvent {
  eventId: string;
  studentId: string;
  type: LearningEventType;
  timestamp: string; // ISO
  source: string; // api | engine | system
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  schemaVersion: number;
  correlationId: string | null;
  createdAt: string;
}

export interface CreateLearningEventInput {
  studentId: string;
  type: LearningEventType;
  source: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
  correlationId?: string;
  schemaVersion?: number;
}

export const LEARNING_EVENT_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "invalid_event",
  "network",
  "unknown",
] as const;

export type LearningEventErrorCode = (typeof LEARNING_EVENT_ERROR_CODES)[number];
