/**
 * Execution error normalization — same discipline as roadmap/goals/auth:
 * domain codes become translation keys, unknown failures collapse to a
 * safe generic message, engine internals are never forwarded (§19).
 */

import { ApiError } from "@/lib/api/client";
import { ExecutionApiError } from "@/services/execution.service";
import { isExecutionErrorCode, type ExecutionErrorCode } from "@/types/execution";

export interface NormalizedExecutionError {
  code: ExecutionErrorCode;
  /** Translation key resolved by `useT()` at render time. */
  messageKey: string;
  retryable: boolean;
}

const MESSAGE_KEYS: Record<ExecutionErrorCode, string> = {
  unauthenticated: "execution.errors.unauthenticated",
  forbidden: "execution.errors.forbidden",
  execution_not_found: "execution.errors.notFound",
  invalid_transition: "execution.errors.invalidTransition",
  unit_unavailable: "execution.errors.unitUnavailable",
  evidence_invalid: "execution.errors.evidenceInvalid",
  conflict: "execution.errors.conflict",
  network: "execution.errors.network",
  unknown: "execution.errors.generic",
};

const RETRYABLE: ReadonlySet<ExecutionErrorCode> = new Set(["network", "unknown"]);

export function normalizeExecutionError(error: unknown): NormalizedExecutionError {
  const code = resolveCode(error);
  return { code, messageKey: MESSAGE_KEYS[code], retryable: RETRYABLE.has(code) };
}

function resolveCode(error: unknown): ExecutionErrorCode {
  if (error instanceof ExecutionApiError) return error.executionCode;
  if (error instanceof ApiError) {
    if (isExecutionErrorCode(error.code)) return error.code;
    if (error.code === "network" || error.status === 0) return "network";
    return "unknown";
  }
  if (error instanceof TypeError) return "network";
  return "unknown";
}
