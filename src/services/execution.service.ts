/**
 * Execution service — the single entry point for learning-unit execution
 * (Phase 7, §15).
 *
 * UI → hooks → THIS service → mockExecutionEngine (mock ⇄ http).
 *
 * Ownership (§18): `studentId` is resolved from the authenticated session
 * via the shared session guard — never from client input. The roadmap is
 * resolved server-side too; the client only ever names a learning unit,
 * and unknown/foreign ids collapse to 404 so existence is never leaked.
 */

import { ApiError, EXECUTIONS_USE_API, httpRequest, mockRequest } from "@/lib/api/client";
import {
  EvidenceInvalidError,
  ExecutionConflictError,
  ExecutionNotFoundError,
  ExecutionUnauthorizedError,
  LearningUnitUnavailableError,
} from "@/services/execution/execution-errors";
import { mockExecutionEngine } from "@/services/engines";
import { InvalidExecutionTransitionError } from "@/services/execution/execution-state-machine";
import { requireStudentId } from "@/services/session-guard";
import type {
  EvidenceInput,
  LearningUnitExecution,
  RoadmapExecutionView,
  UnitLearningContext,
} from "@/types/execution";
import { isExecutionErrorCode, type ExecutionErrorCode } from "@/types/execution";

/** Execution-specific error carrying a stable, non-sensitive domain code. */
export class ExecutionApiError extends ApiError {
  constructor(
    readonly executionCode: ExecutionErrorCode,
    status: number,
    message = executionCode,
  ) {
    super(message, status, executionCode);
    this.name = "ExecutionApiError";
  }
}

export function toExecutionError(error: unknown): ExecutionApiError {
  if (error instanceof ExecutionApiError) return error;
  if (error instanceof ExecutionUnauthorizedError) {
    return new ExecutionApiError(error.code, error.status);
  }
  if (error instanceof ExecutionNotFoundError) {
    return new ExecutionApiError("execution_not_found", 404);
  }
  if (error instanceof LearningUnitUnavailableError) {
    return new ExecutionApiError("unit_unavailable", 409);
  }
  if (error instanceof InvalidExecutionTransitionError) {
    return new ExecutionApiError("invalid_transition", 409);
  }
  if (error instanceof EvidenceInvalidError) {
    return new ExecutionApiError("evidence_invalid", 422);
  }
  if (error instanceof ExecutionConflictError) {
    return new ExecutionApiError("conflict", 409);
  }
  if (error instanceof ApiError) {
    if (isExecutionErrorCode(error.code)) return new ExecutionApiError(error.code, error.status);
    if (error.code === "network" || error.status === 0) {
      return new ExecutionApiError("network", error.status ?? 0);
    }
    return new ExecutionApiError("unknown", error.status);
  }
  if (error instanceof TypeError) return new ExecutionApiError("network", 0);
  return new ExecutionApiError("unknown", 0);
}

/** Same funnel for the mock seam: callers always see ExecutionApiError. */
function viaMock<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  return mockRequest(run, signal).catch((error: unknown) => {
    throw toExecutionError(error);
  });
}

function viaHttp<T>(run: () => Promise<T>): Promise<T> {
  return run().catch((error: unknown) => {
    throw toExecutionError(error);
  });
}

export const executionService = {
  /**
   * Runtime execution view over the student's ACTIVE roadmap — null when
   * no roadmap exists yet (the roadmap flow owns that case).
   */
  getExecutionView(signal?: AbortSignal): Promise<RoadmapExecutionView | null> {
    return EXECUTIONS_USE_API
      ? viaHttp(() => httpRequest<RoadmapExecutionView | null>("/api/executions/view", { signal }))
      : viaMock(async () => {
          const studentId = await requireStudentId();
          return mockExecutionEngine.getExecutionView(studentId);
        }, signal);
  },

  /** Everything the learn screen needs for one unit, resolved server-side. */
  getUnitContext(learningUnitId: string, signal?: AbortSignal): Promise<UnitLearningContext> {
    return EXECUTIONS_USE_API
      ? viaHttp(() =>
          httpRequest<UnitLearningContext>(`/api/executions/units/${learningUnitId}/context`, {
            signal,
          }),
        )
      : viaMock(async () => {
          const studentId = await requireStudentId();
          return mockExecutionEngine.getUnitContext(learningUnitId, studentId);
        }, signal);
  },

  /**
   * Starts (or resumes/retries) a unit. Idempotent: repeated starts
   * return the same execution record — never duplicates (§16).
   */
  startLearningUnit(
    learningUnitId: string,
    signal?: AbortSignal,
  ): Promise<LearningUnitExecution> {
    return EXECUTIONS_USE_API
      ? viaHttp(() =>
          httpRequest<LearningUnitExecution>(`/api/executions/units/${learningUnitId}/start`, {
            method: "POST",
            signal,
          }),
        )
      : viaMock(async () => {
          const studentId = await requireStudentId();
          return mockExecutionEngine.startLearningUnit(learningUnitId, studentId);
        }, signal);
  },

  /** Submits the student's text evidence (solution + reasoning). */
  submitEvidence(
    learningUnitId: string,
    input: EvidenceInput,
    signal?: AbortSignal,
  ): Promise<LearningUnitExecution> {
    return EXECUTIONS_USE_API
      ? viaHttp(() =>
          httpRequest<LearningUnitExecution>(`/api/executions/units/${learningUnitId}/evidence`, {
            method: "POST",
            body: input,
            signal,
          }),
        )
      : viaMock(async () => {
          const studentId = await requireStudentId();
          return mockExecutionEngine.submitEvidence(learningUnitId, input, studentId);
        }, signal);
  },

  /** Runs the deterministic development evaluation (§9 — no fake AI). */
  evaluateExecution(
    learningUnitId: string,
    signal?: AbortSignal,
  ): Promise<LearningUnitExecution> {
    return EXECUTIONS_USE_API
      ? viaHttp(() =>
          httpRequest<LearningUnitExecution>(`/api/executions/units/${learningUnitId}/evaluate`, {
            method: "POST",
            signal,
          }),
        )
      : viaMock(async () => {
          const studentId = await requireStudentId();
          return mockExecutionEngine.evaluateExecution(learningUnitId, studentId);
        }, signal);
  },
};
