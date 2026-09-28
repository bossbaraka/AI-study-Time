/**
 * Goal Discovery service — the single entry point for goal operations.
 *
 * UI → hooks → THIS service → engine (mock ⇄ http).
 *
 * Ownership (§16): `studentId` is ALWAYS resolved from the authenticated
 * session (mock: auth service; real: the backend derives it from the
 * session cookie). It is never accepted from client input, so a crafted
 * request cannot read or lock another student's goal.
 */

import { ApiError, GOALS_USE_API, httpRequest, mockRequest } from "@/lib/api/client";
import { assessmentResultSource, mockGoalEngine } from "@/services/engines";
import { requireStudentId } from "@/services/session-guard";
import { isGoalErrorCode } from "@/types/goal";
import type {
  GoalDiscoveryInput,
  GoalRefinePatch,
  GoalValidationResult,
  GoalWithValidation,
  LearningGoal,
} from "@/types/goal";

/** Goal-specific error carrying a stable, non-sensitive domain code. */
export class GoalApiError extends ApiError {
  constructor(
    readonly goalCode: import("@/types/goal").GoalErrorCode,
    status: number,
    message = goalCode,
  ) {
    super(message, status, goalCode);
    this.name = "GoalApiError";
  }
}

export function toGoalError(error: unknown): GoalApiError {
  if (error instanceof GoalApiError) return error;
  if (error instanceof ApiError) {
    if (isGoalErrorCode(error.code)) return new GoalApiError(error.code, error.status);
    if (error.code === "network" || error.status === 0) {
      return new GoalApiError("network", error.status);
    }
    return new GoalApiError("unknown", error.status);
  }
  if (error instanceof TypeError) return new GoalApiError("network", 0);
  return new GoalApiError("unknown", 0);
}

function viaHttp<T>(run: () => Promise<T>): Promise<T> {
  return run().catch((error: unknown) => {
    throw toGoalError(error);
  });
}

/** Same funnel for the mock seam: callers always see GoalApiError. */
function viaMock<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  return mockRequest(run, signal).catch((error: unknown) => {
    throw toGoalError(error);
  });
}

export const goalDiscoveryService = {
  /** The student's current goal (any live status incl. locked), or null. */
  getActiveGoal(signal?: AbortSignal): Promise<LearningGoal | null> {
    return GOALS_USE_API
      ? viaHttp(() =>
          httpRequest<LearningGoal | null>("/api/goals/active", { signal }),
        )
      : viaMock(async () => {
          const studentId = await requireStudentId();
          return mockGoalEngine.getActiveGoal(studentId);
        });
  },

  getGoal(goalId: string, signal?: AbortSignal): Promise<LearningGoal> {
    return GOALS_USE_API
      ? viaHttp(() => httpRequest<LearningGoal>(`/api/goals/${goalId}`, { signal }))
      : viaMock(async () => {
          const studentId = await requireStudentId();
          return mockGoalEngine.getGoal(goalId, studentId);
        });
  },

  /**
   * Creates (or replays, via `idempotencyKey`) the student's goal.
   * Diagnosis context is attached engine-side from the latest completed
   * assessment — the client never supplies it.
   */
  createGoal(
    input: GoalDiscoveryInput,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<GoalWithValidation> {
    return GOALS_USE_API
      ? viaHttp(() =>
          httpRequest<GoalWithValidation>("/api/goals", {
            method: "POST",
            body: { input, idempotencyKey },
            signal,
          }),
        )
      : viaMock(async () => {
          const studentId = await requireStudentId();
          // Resolved here (application layer) through the assessment port —
          // the client never supplies diagnosis context, and the goal
          // engine never reaches across a domain boundary itself.
          const diagnosisContext =
            await assessmentResultSource.getLatestCompletedResult(studentId);
          return mockGoalEngine.createGoal(input, {
            studentId,
            idempotencyKey,
            diagnosisContext,
          });
        });
  },

  /** Student-driven refinement; re-validates and returns the new verdict. */
  updateGoal(
    goalId: string,
    patch: GoalRefinePatch,
    signal?: AbortSignal,
  ): Promise<GoalWithValidation> {
    return GOALS_USE_API
      ? viaHttp(() =>
          httpRequest<GoalWithValidation>(`/api/goals/${goalId}`, {
            method: "PATCH",
            body: patch,
            signal,
          }),
        )
      : viaMock(async () => {
          const studentId = await requireStudentId();
          return mockGoalEngine.updateGoal(goalId, studentId, patch);
        });
  },

  validateGoal(goalId: string, signal?: AbortSignal): Promise<GoalValidationResult> {
    return GOALS_USE_API
      ? viaHttp(() =>
          httpRequest<GoalValidationResult>(`/api/goals/${goalId}/validation`, { signal }),
        )
      : viaMock(async () => {
          const studentId = await requireStudentId();
          return mockGoalEngine.validateGoal(goalId, studentId);
        });
  },

  /** Idempotent lock: replays never duplicate the transition (§14). */
  lockGoal(goalId: string, idempotencyKey: string, signal?: AbortSignal): Promise<LearningGoal> {
    return GOALS_USE_API
      ? viaHttp(() =>
          httpRequest<LearningGoal>(`/api/goals/${goalId}/lock`, {
            method: "POST",
            body: { idempotencyKey },
            signal,
          }),
        )
      : viaMock(async () => {
          const studentId = await requireStudentId();
          return mockGoalEngine.lockGoal(goalId, studentId, idempotencyKey);
        });
  },

  /** Explicit revision of a locked goal — the only way to edit one (§5). */
  reviseGoal(goalId: string, signal?: AbortSignal): Promise<GoalWithValidation> {
    return GOALS_USE_API
      ? viaHttp(() =>
          httpRequest<GoalWithValidation>(`/api/goals/${goalId}/revise`, {
            method: "POST",
            signal,
          }),
        )
      : viaMock(async () => {
          const studentId = await requireStudentId();
          return mockGoalEngine.reviseGoal(goalId, studentId);
        });
  },
};
