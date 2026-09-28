/**
 * Assessment service — the single entry point for all assessment operations.
 *
 * UI → hooks → THIS service → transport.
 * Components never call fetch, never see the engine, never contain
 * adaptive/diagnostic logic.
 *
 * Transport resolution (see `ASSESSMENT_USE_API`):
 * - Application runtime → the REAL server-side assessment API. Evaluation
 *   is server-authoritative: the client submits a response, the server
 *   holds the answer key and decides the score. No scoring data ever
 *   reaches the browser.
 * - Unit tests → the in-process engine, keeping component tests hermetic.
 *
 * Ownership: `studentId` is resolved from the authenticated session by
 * `requireStudentId` on the mock path, and from the session cookie by the
 * route handlers on the real path. It is never accepted from client input.
 */

import { ApiError, httpRequest, mockRequest } from "@/lib/api/client";
import { mockAssessmentEngine } from "@/services/engines";
import { requireStudentId } from "@/services/session-guard";
import { isAssessmentErrorCode } from "@/types/assessment";
import type {
  AssessmentResult,
  AssessmentSession,
  StudentAssessmentProfile,
  SubmitAnswerPayload,
} from "@/types/assessment";

/**
 * Assessment runs against the real server-side API in the application and
 * against the in-process engine under Vitest. One switch, nothing else
 * changes — mirrors `AUTH_USE_GATEWAY` in `lib/api/client.ts`.
 */
export const ASSESSMENT_USE_API = !process.env.VITEST;

/** Assessment-specific error carrying a stable, non-sensitive domain code. */
export class AssessmentApiError extends ApiError {
  constructor(
    readonly assessmentCode: import("@/types/assessment").AssessmentErrorCode,
    status: number,
    message = assessmentCode,
  ) {
    super(message, status, assessmentCode);
    this.name = "AssessmentApiError";
  }
}

function toAssessmentError(error: unknown): AssessmentApiError {
  if (error instanceof AssessmentApiError) return error;
  if (error instanceof ApiError) {
    if (isAssessmentErrorCode(error.code)) {
      return new AssessmentApiError(error.code, error.status);
    }
    if (error.code === "network" || error.status === 0) {
      return new AssessmentApiError("network", error.status);
    }
    if (error.status === 401) return new AssessmentApiError("unauthenticated", 401);
    if (error.status === 403) return new AssessmentApiError("forbidden", 403);
    return new AssessmentApiError("unknown", error.status);
  }
  if (error instanceof TypeError) {
    return new AssessmentApiError("network", 0);
  }
  return new AssessmentApiError("unknown", 0);
}

/** Wraps the real-HTTP branch so every operation normalizes errors identically. */
function viaHttp<T>(run: () => Promise<T>): Promise<T> {
  return run().catch((error: unknown) => {
    throw toAssessmentError(error);
  });
}

/** Same funnel for the in-process branch: callers always see AssessmentApiError. */
function viaEngine<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  return mockRequest(run, signal).catch((error: unknown) => {
    throw toAssessmentError(error);
  });
}

export const assessmentService = {
  /**
   * Creates a session. On the real path the server generates (or selects)
   * the questions AND keeps the answer key — the browser receives the
   * public question only.
   */
  createSession(
    profile?: StudentAssessmentProfile,
    signal?: AbortSignal,
  ): Promise<AssessmentSession> {
    return ASSESSMENT_USE_API
      ? viaHttp(() =>
          httpRequest<AssessmentSession>("/api/assessment/sessions", {
            method: "POST",
            body: { profile },
            signal,
          }),
        )
      : viaEngine(async () => {
          const studentId = await requireStudentId();
          return mockAssessmentEngine.createSession(studentId, profile);
        }, signal);
  },

  /** Most recent unfinished session for the signed-in student, if any. */
  getActiveSession(signal?: AbortSignal): Promise<AssessmentSession | null> {
    return ASSESSMENT_USE_API
      ? viaHttp(() =>
          httpRequest<AssessmentSession | null>("/api/assessment/sessions/active", { signal }),
        )
      : viaEngine(async () => {
          const studentId = await requireStudentId();
          return mockAssessmentEngine.getActiveSession(studentId);
        }, signal);
  },

  getSession(sessionId: string, signal?: AbortSignal): Promise<AssessmentSession> {
    return ASSESSMENT_USE_API
      ? viaHttp(() =>
          httpRequest<AssessmentSession>(`/api/assessment/sessions/${sessionId}`, { signal }),
        )
      : viaEngine(async () => {
          const studentId = await requireStudentId();
          return mockAssessmentEngine.getSession(sessionId, studentId);
        }, signal);
  },

  /**
   * Idempotent via `payload.submissionId` — retries never double-count.
   * The payload carries the student's RESPONSE only; correctness is
   * decided by the server against its own answer key.
   */
  submitAnswer(payload: SubmitAnswerPayload, signal?: AbortSignal): Promise<AssessmentSession> {
    return ASSESSMENT_USE_API
      ? viaHttp(() =>
          httpRequest<AssessmentSession>(
            `/api/assessment/sessions/${payload.sessionId}/answers`,
            { method: "POST", body: payload, signal },
          ),
        )
      : viaEngine(async () => {
          const studentId = await requireStudentId();
          return mockAssessmentEngine.submitAnswer(payload, studentId);
        }, signal);
  },

  pauseSession(sessionId: string, signal?: AbortSignal): Promise<AssessmentSession> {
    return ASSESSMENT_USE_API
      ? viaHttp(() =>
          httpRequest<AssessmentSession>(`/api/assessment/sessions/${sessionId}/pause`, {
            method: "POST",
            signal,
          }),
        )
      : viaEngine(async () => {
          const studentId = await requireStudentId();
          return mockAssessmentEngine.pauseSession(sessionId, studentId);
        }, signal);
  },

  resumeSession(sessionId: string, signal?: AbortSignal): Promise<AssessmentSession> {
    return ASSESSMENT_USE_API
      ? viaHttp(() =>
          httpRequest<AssessmentSession>(`/api/assessment/sessions/${sessionId}/resume`, {
            method: "POST",
            signal,
          }),
        )
      : viaEngine(async () => {
          const studentId = await requireStudentId();
          return mockAssessmentEngine.resumeSession(sessionId, studentId);
        }, signal);
  },

  completeSession(sessionId: string, signal?: AbortSignal): Promise<AssessmentSession> {
    return ASSESSMENT_USE_API
      ? viaHttp(() =>
          httpRequest<AssessmentSession>(`/api/assessment/sessions/${sessionId}/complete`, {
            method: "POST",
            signal,
          }),
        )
      : viaEngine(async () => {
          const studentId = await requireStudentId();
          return mockAssessmentEngine.completeSession(sessionId, studentId);
        }, signal);
  },

  getResults(sessionId: string, signal?: AbortSignal): Promise<AssessmentResult> {
    return ASSESSMENT_USE_API
      ? viaHttp(() =>
          httpRequest<AssessmentResult>(`/api/assessment/sessions/${sessionId}/results`, {
            signal,
          }),
        )
      : viaEngine(async () => {
          const studentId = await requireStudentId();
          return mockAssessmentEngine.getResults(sessionId, studentId);
        }, signal);
  },

  /** Most recent completed diagnosis — the STEP 5 goal-discovery input. */
  getLatestResult(signal?: AbortSignal): Promise<AssessmentResult | null> {
    return ASSESSMENT_USE_API
      ? viaHttp(() =>
          httpRequest<AssessmentResult | null>("/api/assessment/results/latest", { signal }),
        )
      : viaEngine(async () => {
          const studentId = await requireStudentId();
          return mockAssessmentEngine.getLatestCompletedResult(studentId);
        }, signal);
  },
};
