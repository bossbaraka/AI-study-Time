/**
 * Assessment service — the single entry point for all assessment operations.
 *
 * UI → hooks → THIS service → API client (mock ⇄ http).
 * Components never call fetch, never see the mock engine, never contain
 * adaptive/diagnostic logic. When the real AI assessment backend lands,
 * only the `USE_MOCK` branch is removed — the contract is identical.
 */

import { ApiError, USE_MOCK, httpRequest, mockRequest } from "@/lib/api/client";
import { mockAssessmentEngine } from "@/services/assessment/mock-assessment-engine";
import type { BankItem } from "@/services/assessment/question-bank";
import { isAssessmentErrorCode } from "@/types/assessment";
import type {
  AssessmentResult,
  AssessmentSession,
  StudentAssessmentProfile,
  SubmitAnswerPayload,
} from "@/types/assessment";

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

export const assessmentService = {
  async createSession(
    profile?: StudentAssessmentProfile,
    signal?: AbortSignal,
  ): Promise<AssessmentSession> {
    let customData: { bank: BankItem[]; topics: string[] } | undefined;
    if (profile) {
      try {
        const res = await fetch("/api/assessment/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
          signal,
        });
        if (res.ok) {
          customData = (await res.json()) as { bank: BankItem[]; topics: string[] };
        }
      } catch (err) {
        console.warn("[assessmentService] AI generation fetch failed, falling back:", err);
      }
    }

    return USE_MOCK
      ? mockRequest(() => mockAssessmentEngine.createSession(profile, customData), signal)
      : viaHttp(() =>
          httpRequest<AssessmentSession>("/api/assessment/sessions", {
            method: "POST",
            body: { profile, customData },
            signal,
          }),
        );
  },

  /** Most recent unfinished session for the signed-in student, if any. */
  getActiveSession(signal?: AbortSignal): Promise<AssessmentSession | null> {
    return USE_MOCK
      ? mockRequest(() => mockAssessmentEngine.getActiveSession(), signal)
      : viaHttp(() =>
          httpRequest<AssessmentSession | null>("/api/assessment/sessions/active", { signal }),
        );
  },

  getSession(sessionId: string, signal?: AbortSignal): Promise<AssessmentSession> {
    return USE_MOCK
      ? mockRequest(() => mockAssessmentEngine.getSession(sessionId), signal)
      : viaHttp(() =>
          httpRequest<AssessmentSession>(`/api/assessment/sessions/${sessionId}`, { signal }),
        );
  },

  /** Idempotent via `payload.submissionId` — retries never double-count. */
  submitAnswer(payload: SubmitAnswerPayload, signal?: AbortSignal): Promise<AssessmentSession> {
    return USE_MOCK
      ? mockRequest(() => mockAssessmentEngine.submitAnswer(payload), signal)
      : viaHttp(() =>
          httpRequest<AssessmentSession>(
            `/api/assessment/sessions/${payload.sessionId}/answers`,
            { method: "POST", body: payload, signal },
          ),
        );
  },

  pauseSession(sessionId: string, signal?: AbortSignal): Promise<AssessmentSession> {
    return USE_MOCK
      ? mockRequest(() => mockAssessmentEngine.pauseSession(sessionId), signal)
      : viaHttp(() =>
          httpRequest<AssessmentSession>(`/api/assessment/sessions/${sessionId}/pause`, {
            method: "POST",
            signal,
          }),
        );
  },

  resumeSession(sessionId: string, signal?: AbortSignal): Promise<AssessmentSession> {
    return USE_MOCK
      ? mockRequest(() => mockAssessmentEngine.resumeSession(sessionId), signal)
      : viaHttp(() =>
          httpRequest<AssessmentSession>(`/api/assessment/sessions/${sessionId}/resume`, {
            method: "POST",
            signal,
          }),
        );
  },

  completeSession(sessionId: string, signal?: AbortSignal): Promise<AssessmentSession> {
    return USE_MOCK
      ? mockRequest(() => mockAssessmentEngine.completeSession(sessionId), signal)
      : viaHttp(() =>
          httpRequest<AssessmentSession>(`/api/assessment/sessions/${sessionId}/complete`, {
            method: "POST",
            signal,
          }),
        );
  },

  getResults(sessionId: string, signal?: AbortSignal): Promise<AssessmentResult> {
    return USE_MOCK
      ? mockRequest(() => mockAssessmentEngine.getResults(sessionId), signal)
      : viaHttp(() =>
          httpRequest<AssessmentResult>(`/api/assessment/sessions/${sessionId}/results`, {
            signal,
          }),
        );
  },

  /** Most recent completed diagnosis — the STEP 5 goal-discovery input. */
  getLatestResult(signal?: AbortSignal): Promise<AssessmentResult | null> {
    return USE_MOCK
      ? mockRequest(() => mockAssessmentEngine.getLatestCompletedResult(), signal)
      : viaHttp(() =>
          httpRequest<AssessmentResult | null>("/api/assessment/results/latest", { signal }),
        );
  },
};
