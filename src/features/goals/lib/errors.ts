/**
 * Goal error normalization — same discipline as auth and assessment:
 * domain codes become translation keys, unknown failures collapse to a
 * safe generic message, engine internals are never forwarded.
 */

import { ApiError } from "@/lib/api/client";
import { GoalApiError } from "@/services/goal-discovery.service";
import { isGoalErrorCode, type GoalErrorCode } from "@/types/goal";

export interface NormalizedGoalError {
  code: GoalErrorCode;
  /** Translation key resolved by `useT()` at render time. */
  messageKey: string;
  retryable: boolean;
}

const MESSAGE_KEYS: Record<GoalErrorCode, string> = {
  unauthenticated: "goals.errors.unauthenticated",
  forbidden: "goals.errors.forbidden",
  goal_not_found: "goals.errors.notFound",
  invalid_transition: "goals.errors.invalidTransition",
  validation_failed: "goals.errors.validationFailed",
  network: "goals.errors.network",
  unknown: "goals.errors.generic",
};

const RETRYABLE: ReadonlySet<GoalErrorCode> = new Set(["network", "unknown"]);

export function normalizeGoalError(error: unknown): NormalizedGoalError {
  const code = resolveCode(error);
  return { code, messageKey: MESSAGE_KEYS[code], retryable: RETRYABLE.has(code) };
}

function resolveCode(error: unknown): GoalErrorCode {
  if (error instanceof GoalApiError) return error.goalCode;
  if (error instanceof ApiError) {
    if (isGoalErrorCode(error.code)) return error.code;
    if (error.code === "network" || error.status === 0) return "network";
    return "unknown";
  }
  if (error instanceof TypeError) return "network";
  return "unknown";
}
