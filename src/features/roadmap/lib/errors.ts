/**
 * Roadmap error normalization — same discipline as auth/assessment/goals:
 * domain codes become translation keys, unknown failures collapse to a
 * safe generic message, engine internals are never forwarded (§33).
 */

import { ApiError } from "@/lib/api/client";
import { RoadmapApiError } from "@/services/roadmap.service";
import { isRoadmapErrorCode, type RoadmapErrorCode } from "@/types/roadmap";

export interface NormalizedRoadmapError {
  code: RoadmapErrorCode;
  /** Translation key resolved by `useT()` at render time. */
  messageKey: string;
  retryable: boolean;
}

const MESSAGE_KEYS: Record<RoadmapErrorCode, string> = {
  unauthenticated: "roadmap.errors.unauthenticated",
  forbidden: "roadmap.errors.forbidden",
  roadmap_not_found: "roadmap.errors.notFound",
  invalid_transition: "roadmap.errors.invalidTransition",
  no_locked_goal: "roadmap.errors.noLockedGoal",
  infeasible_timeframe: "roadmap.errors.infeasibleTimeframe",
  generation_failed: "roadmap.errors.generationFailed",
  network: "roadmap.errors.network",
  unknown: "roadmap.errors.generic",
};

const RETRYABLE: ReadonlySet<RoadmapErrorCode> = new Set([
  "network",
  "unknown",
  "generation_failed",
]);

export function normalizeRoadmapError(error: unknown): NormalizedRoadmapError {
  const code = resolveCode(error);
  return { code, messageKey: MESSAGE_KEYS[code], retryable: RETRYABLE.has(code) };
}

function resolveCode(error: unknown): RoadmapErrorCode {
  if (error instanceof RoadmapApiError) return error.roadmapCode;
  if (error instanceof ApiError) {
    if (isRoadmapErrorCode(error.code)) return error.code;
    if (error.code === "network" || error.status === 0) return "network";
    return "unknown";
  }
  if (error instanceof TypeError) return "network";
  return "unknown";
}
