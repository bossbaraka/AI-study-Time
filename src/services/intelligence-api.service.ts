/**
 * Intelligence API services — client-side HTTP transport for mastery,
 * diagnosis, adaptive, recall, behavior, recovery, evidence,
 * learning-events and server-authoritative tests.
 *
 * This module is CLIENT-SAFE: it never imports `pg`, Prisma, or any
 * server-only store. Under Vitest the mock path returns deterministic
 * static data so component tests remain hermetic. Server-side tests
 * should call the application services directly (they are server-only).
 */

import { httpRequest, mockRequest, clone } from "@/lib/api/client";
import type { Concept } from "@/types/concept";
import type { ConceptState } from "@/types/concept-state";
import type { AdaptiveDecision } from "@/types/adaptive";
import type { TestAttempt, TestDefinition } from "@/types/test-attempt";
import { db } from "@/services/mock-db";

const REAL_TRANSPORT = !process.env.VITEST;

// ------------------------------------------------------------------
// Concepts
// ------------------------------------------------------------------
export const conceptService = {
  list(signal?: AbortSignal): Promise<Concept[]> {
    return REAL_TRANSPORT
      ? httpRequest<Concept[]>("/api/concepts", { signal })
      : mockRequest(async () => [] as Concept[], signal);
  },
};

// ------------------------------------------------------------------
// ConceptStates
// ------------------------------------------------------------------
export const conceptStateService = {
  list(signal?: AbortSignal): Promise<ConceptState[]> {
    return REAL_TRANSPORT
      ? httpRequest<ConceptState[]>("/api/concept-states", { signal })
      : mockRequest(async () => [] as ConceptState[], signal);
  },
};

// ------------------------------------------------------------------
// Mastery (derived view)
// ------------------------------------------------------------------
export interface MasteryViewItem {
  conceptId: string;
  conceptName: string;
  domain: string;
  state: ConceptState;
  diagnosis: import("@/services/diagnosis/diagnosis-engine").ConceptDiagnosis;
  achieved: boolean;
}

export const masteryApiService = {
  getView(signal?: AbortSignal): Promise<MasteryViewItem[]> {
    return REAL_TRANSPORT
      ? httpRequest<MasteryViewItem[]>("/api/mastery", { signal })
      : mockRequest(async () => [] as MasteryViewItem[], signal);
  },
};

// ------------------------------------------------------------------
// Diagnosis
// ------------------------------------------------------------------
export const diagnosisService = {
  list(signal?: AbortSignal): Promise<import("@/services/diagnosis/diagnosis-engine").ConceptDiagnosis[]> {
    return REAL_TRANSPORT
      ? httpRequest("/api/diagnosis", { signal })
      : mockRequest(async () => [] as import("@/services/diagnosis/diagnosis-engine").ConceptDiagnosis[], signal);
  },
};

// ------------------------------------------------------------------
// Adaptive
// ------------------------------------------------------------------
export const adaptiveService = {
  getNext(params?: { goalId?: string; roadmapId?: string; currentUnitId?: string }, signal?: AbortSignal): Promise<AdaptiveDecision> {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    const path = qs ? `/api/adaptive/next?${qs}` : "/api/adaptive/next";
    return REAL_TRANSPORT
      ? httpRequest<AdaptiveDecision>(path, { signal })
      : mockRequest(async () => ({
          primary: {
            action: "PRACTICE" as const,
            conceptId: null,
            unitId: null,
            reason: "Mock adaptive: continue practice.",
            priority: 50,
            metadata: {},
          },
          alternatives: [],
          evaluatedAt: new Date().toISOString(),
        } as AdaptiveDecision), signal);
  },
};

// ------------------------------------------------------------------
// Recall (evidence-driven)
// ------------------------------------------------------------------
export const recallScheduleService = {
  listDue(signal?: AbortSignal) {
    return REAL_TRANSPORT
      ? httpRequest("/api/recall/schedules?due=true", { signal })
      : mockRequest(async () => [] as Array<{ schedule: import("@/types/recall").RecallSchedule; concept: Concept | null }>, signal);
  },
  listAll(signal?: AbortSignal) {
    return REAL_TRANSPORT
      ? httpRequest("/api/recall/schedules", { signal })
      : mockRequest(async () => [] as Array<{ schedule: import("@/types/recall").RecallSchedule; concept: Concept | null }>, signal);
  },
  review(conceptId: string, quality: number, signal?: AbortSignal) {
    return REAL_TRANSPORT
      ? httpRequest("/api/recall/review", { method: "POST", body: { conceptId, quality }, signal })
      : mockRequest(async () => ({ schedule: null }), signal) as Promise<unknown>;
  },
};

// ------------------------------------------------------------------
// Evidence
// ------------------------------------------------------------------
export const evidenceService = {
  list(signal?: AbortSignal) {
    return REAL_TRANSPORT
      ? httpRequest("/api/evidence", { signal })
      : mockRequest(async () => [] as import("@/types/evidence").Evidence[], signal);
  },
  create(input: import("@/types/evidence").CreateEvidenceInput, signal?: AbortSignal) {
    return REAL_TRANSPORT
      ? httpRequest("/api/evidence", { method: "POST", body: input, signal })
      : mockRequest(async () => ({
          id: "mock_ev",
          studentId: "test-student",
          conceptId: input.conceptId ?? null,
          kind: input.kind,
          payload: input.payload,
          score: input.score ?? null,
          timeSpentSeconds: input.timeSpentSeconds ?? null,
          attemptCount: 1,
          hintUsed: false,
          hintCount: 0,
          learningUnitId: null,
          roadmapId: null,
          assessmentSessionId: null,
          testAttemptId: null,
          immutable: false,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as import("@/types/evidence").Evidence), signal);
  },
};

// ------------------------------------------------------------------
// Tests (server-authoritative)
// ------------------------------------------------------------------
export const testDefinitionService = {
  list(signal?: AbortSignal): Promise<TestDefinition[]> {
    return REAL_TRANSPORT
      ? httpRequest("/api/tests", { signal }).then((defs: unknown) => defs as TestDefinition[])
      : mockRequest(async () => clone(db.tests as unknown as TestDefinition[]), signal) as Promise<TestDefinition[]>;
  },
  attempts(signal?: AbortSignal): Promise<TestAttempt[]> {
    return REAL_TRANSPORT
      ? httpRequest("/api/tests/attempts", { signal })
      : mockRequest(async () => [] as TestAttempt[], signal);
  },
  submit(testId: string, answers: import("@/types/test-attempt").TestAnswerInput[], timeSpentSeconds: number, signal?: AbortSignal): Promise<TestAttempt> {
    return REAL_TRANSPORT
      ? httpRequest(`/api/tests/${testId}/submit`, { method: "POST", body: { answers, timeSpentSeconds }, signal })
      : mockRequest(async () => ({
          id: `ta_${Date.now()}`,
          studentId: "test-student",
          testId,
          status: "graded",
          score: 80,
          timeSpentSeconds,
          answers,
          gradedAnswers: [],
          strongTopics: [],
          needsReviewTopics: [],
          recommendation: "continue",
          createdAt: new Date().toISOString(),
        } as TestAttempt), signal);
  },
};

// ------------------------------------------------------------------
// Behavior / Recovery / Learning Events
// ------------------------------------------------------------------
export const behaviorApiService = {
  get(signal?: AbortSignal) {
    return REAL_TRANSPORT
      ? httpRequest("/api/behavior", { signal })
      : mockRequest(async () => clone(db.behavior) as unknown as import("@/services/behavior/behavior-engine").BehaviorInsights, signal) as Promise<import("@/services/behavior/behavior-engine").BehaviorInsights>;
  },
};

export const recoveryApiService = {
  list(signal?: AbortSignal) {
    return REAL_TRANSPORT
      ? httpRequest("/api/recovery", { signal })
      : mockRequest(async () => [] as import("@/services/recovery/recovery-engine").RecoveryPlan[], signal);
  },
};
