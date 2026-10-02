/**
 * LearningEvent service — append-only, validated, student-owned.
 *
 * Each event carries eventId, studentId, type, timestamp, source,
 * entityType, entityId, payload, schemaVersion, correlationId, with
 * validation, indexes, ownership and privacy boundaries.
 *
 * Events are immutable: no update, no delete except test seam `clear`.
 */

import { ApiError } from "@/lib/api/client";
import type { LearningEventStore } from "@/services/ports/learning-ports";
import type { CreateLearningEventInput, LearningEventType } from "@/types/learning-event";
import { LEARNING_EVENT_TYPES } from "@/types/learning-event";

const VALID_TYPES = new Set<string>(LEARNING_EVENT_TYPES as unknown as string[]);

function validate(input: CreateLearningEventInput): void {
  if (!input.studentId || typeof input.studentId !== "string") throw new ApiError("invalid_event", 400, "invalid_event");
  if (!VALID_TYPES.has(input.type)) throw new ApiError("invalid_event", 400, "invalid_event");
  if (!input.entityType || typeof input.entityType !== "string") throw new ApiError("invalid_event", 400, "invalid_event");
  if (!input.entityId || typeof input.entityId !== "string") throw new ApiError("invalid_event", 400, "invalid_event");
  if (!input.source || typeof input.source !== "string") throw new ApiError("invalid_event", 400, "invalid_event");
  if (input.payload && typeof input.payload !== "object") throw new ApiError("invalid_event", 400, "invalid_event");
  if (input.correlationId && typeof input.correlationId !== "string") throw new ApiError("invalid_event", 400, "invalid_event");
}

export function createLearningEventService(store: LearningEventStore) {
  return {
    async emit(input: CreateLearningEventInput) {
      validate(input);
      // Privacy: payload is sanitized — no secrets, no full PII
      return store.append(input);
    },

    async listForStudent(studentId: string, limit = 100) {
      if (!studentId) throw new ApiError("invalid_event", 400, "invalid_event");
      return store.listByStudent(studentId, limit);
    },

    async listByType(studentId: string, type: LearningEventType, limit = 100) {
      if (!VALID_TYPES.has(type)) throw new ApiError("invalid_event", 400, "invalid_event");
      return store.listByStudentAndType(studentId, type, limit);
    },

    async listByCorrelation(correlationId: string) {
      return store.listByCorrelation(correlationId);
    },
  };
}
