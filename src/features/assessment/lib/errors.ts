/**
 * Assessment error normalization — same discipline as the auth layer.
 *
 * Backend codes become translation keys; unknown failures collapse to a
 * safe generic message. Engine internals, prompts and scoring details are
 * never forwarded to the UI.
 */

import { ApiError } from "@/lib/api/client";
import { AssessmentApiError } from "@/services/assessment.service";
import { isAssessmentErrorCode, type AssessmentErrorCode } from "@/types/assessment";

export interface NormalizedAssessmentError {
  code: AssessmentErrorCode;
  /** Translation key resolved by `useT()` at render time. */
  messageKey: string;
  /** Whether the UI should offer a retry of the same operation. */
  retryable: boolean;
}

const MESSAGE_KEYS: Record<AssessmentErrorCode, string> = {
  unauthenticated: "assessment.errors.unauthenticated",
  forbidden: "assessment.errors.forbidden",
  session_not_found: "assessment.errors.sessionUnavailable",
  session_not_active: "assessment.errors.sessionNotActive",
  assessment_not_completed: "assessment.errors.resultsNotReady",
  invalid_response: "assessment.errors.answerRejected",
  network: "assessment.errors.network",
  unknown: "assessment.errors.generic",
};

const RETRYABLE: ReadonlySet<AssessmentErrorCode> = new Set([
  "network",
  "unknown",
  "assessment_not_completed",
]);

export function normalizeAssessmentError(error: unknown): NormalizedAssessmentError {
  const code = resolveCode(error);
  return { code, messageKey: MESSAGE_KEYS[code], retryable: RETRYABLE.has(code) };
}

function resolveCode(error: unknown): AssessmentErrorCode {
  if (error instanceof AssessmentApiError) return error.assessmentCode;
  if (error instanceof ApiError) {
    if (isAssessmentErrorCode(error.code)) return error.code;
    if (error.code === "network" || error.status === 0) return "network";
    return "unknown";
  }
  if (error instanceof TypeError) return "network";
  return "unknown";
}

/** True when a submission failed for transport reasons and can be retried safely. */
export function isRetryableSubmissionError(error: unknown): boolean {
  const code = resolveCode(error);
  return code === "network" || code === "unknown";
}
