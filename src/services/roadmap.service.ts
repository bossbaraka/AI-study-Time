/**
 * Roadmap service — the single entry point for roadmap operations (§27).
 *
 * UI → hooks → THIS service → RoadmapEngine (mock ⇄ http).
 *
 * Ownership (§28): `studentId` is resolved from the authenticated session
 * via the shared session guard — never from client input. Cross-student
 * access collapses to 404 so existence is never leaked.
 */

import { ApiError, ROADMAPS_USE_API, httpRequest, mockRequest } from "@/lib/api/client";
import { DependencyCycleError } from "@/services/roadmap/graph";
import { mockRoadmapEngine } from "@/services/engines";
import { InvalidRoadmapTransitionError } from "@/services/roadmap/roadmap-state-machine";
import {
  RoadmapGenerationError,
  RoadmapOwnershipError,
  RoadmapValidationError,
} from "@/services/roadmap/roadmap-errors";
import { requireStudentId } from "@/services/session-guard";
import { isRoadmapErrorCode, type RoadmapErrorCode, type Roadmap, type RoadmapGenerationResult } from "@/types/roadmap";

/** Roadmap-specific error carrying a stable, non-sensitive domain code. */
export class RoadmapApiError extends ApiError {
  constructor(
    readonly roadmapCode: RoadmapErrorCode,
    status: number,
    message = roadmapCode,
  ) {
    super(message, status, roadmapCode);
    this.name = "RoadmapApiError";
  }
}

export function toRoadmapError(error: unknown): RoadmapApiError {
  if (error instanceof RoadmapApiError) return error;
  if (error instanceof RoadmapOwnershipError) {
    return new RoadmapApiError(error.code, error.status);
  }
  if (error instanceof RoadmapGenerationError) {
    return new RoadmapApiError(error.code, error.code === "no_locked_goal" ? 409 : 422);
  }
  if (error instanceof InvalidRoadmapTransitionError) {
    return new RoadmapApiError("invalid_transition", 409);
  }
  if (error instanceof RoadmapValidationError || error instanceof DependencyCycleError) {
    return new RoadmapApiError("generation_failed", 500);
  }
  if (error instanceof ApiError) {
    if (isRoadmapErrorCode(error.code)) return new RoadmapApiError(error.code, error.status);
    if (error.code === "network" || error.status === 0) {
      return new RoadmapApiError("network", error.status ?? 0);
    }
    return new RoadmapApiError("unknown", error.status);
  }
  if (error instanceof TypeError) return new RoadmapApiError("network", 0);
  return new RoadmapApiError("unknown", 0);
}

function viaHttp<T>(run: () => Promise<T>): Promise<T> {
  return run().catch((error: unknown) => {
    throw toRoadmapError(error);
  });
}

/** Same funnel for the mock seam: callers always see RoadmapApiError. */
function viaMock<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  return mockRequest(run, signal).catch((error: unknown) => {
    throw toRoadmapError(error);
  });
}

export const roadmapService = {
  /** The student's live roadmap, or null when none has been generated. */
  getActiveRoadmap(signal?: AbortSignal): Promise<Roadmap | null> {
    return ROADMAPS_USE_API
      ? viaHttp(() => httpRequest<Roadmap | null>("/api/roadmaps/active", { signal }))
      : viaMock(async () => {
          const studentId = await requireStudentId();
          return mockRoadmapEngine.getActiveRoadmap(studentId);
        }, signal);
  },

  getRoadmap(roadmapId: string, signal?: AbortSignal): Promise<Roadmap> {
    return ROADMAPS_USE_API
      ? viaHttp(() => httpRequest<Roadmap>(`/api/roadmaps/${roadmapId}`, { signal }))
      : viaMock(async () => {
          const studentId = await requireStudentId();
          return mockRoadmapEngine.getRoadmap(roadmapId, studentId);
        }, signal);
  },

  /**
   * Generates (or replays) the roadmap for a locked goal. Idempotent on
   * studentId + goalId + goalVersion + engineVersion — repeated clicks
   * never create duplicates (§19).
   */
  generateRoadmap(goalId: string, signal?: AbortSignal): Promise<RoadmapGenerationResult> {
    return ROADMAPS_USE_API
      ? viaHttp(() =>
          httpRequest<RoadmapGenerationResult>("/api/roadmaps/generate", {
            method: "POST",
            body: { goalId },
            signal,
          }),
        )
      : viaMock(async () => {
          const studentId = await requireStudentId();
          return mockRoadmapEngine.generateRoadmap(goalId, studentId);
        }, signal);
  },

  pauseRoadmap(roadmapId: string, signal?: AbortSignal): Promise<Roadmap> {
    return ROADMAPS_USE_API
      ? viaHttp(() =>
          httpRequest<Roadmap>(`/api/roadmaps/${roadmapId}/pause`, { method: "POST", signal }),
        )
      : viaMock(async () => {
          const studentId = await requireStudentId();
          return mockRoadmapEngine.pauseRoadmap(roadmapId, studentId);
        }, signal);
  },

  resumeRoadmap(roadmapId: string, signal?: AbortSignal): Promise<Roadmap> {
    return ROADMAPS_USE_API
      ? viaHttp(() =>
          httpRequest<Roadmap>(`/api/roadmaps/${roadmapId}/resume`, { method: "POST", signal }),
        )
      : viaMock(async () => {
          const studentId = await requireStudentId();
          return mockRoadmapEngine.resumeRoadmap(roadmapId, studentId);
        }, signal);
  },
};
