/**
 * Auth error normalization.
 *
 * Every error that reaches the UI passes through here: backend codes become
 * translation keys, unknown failures collapse to a safe generic message.
 * Stack traces, internal names and tokens are never forwarded.
 */

import { ApiError, AuthApiError } from "@/lib/api/client";
import { isAuthErrorCode, type AuthErrorCode } from "@/types/auth";

export interface NormalizedAuthError {
  code: AuthErrorCode;
  /** Translation key resolved by `useT()` at render time. */
  messageKey: string;
}

const MESSAGE_KEYS: Record<AuthErrorCode, string> = {
  invalid_credentials: "auth.errors.invalidCredentials",
  email_already_registered: "auth.errors.registerFailed",
  token_invalid: "auth.errors.tokenInvalid",
  token_expired: "auth.errors.tokenExpired",
  email_already_verified: "auth.verify.already.title",
  unverified_email: "auth.verify.pending.title",
  session_expired: "auth.sessionExpired",
  rate_limited: "auth.errors.rateLimited",
  account_locked: "auth.errors.accountLocked",
  account_suspended: "auth.errors.accountSuspended",
  account_pending: "auth.errors.accountPending",
  invitation_invalid: "auth.errors.invitationInvalid",
  invitation_expired: "auth.errors.invitationExpired",
  identifier_taken: "auth.errors.identifierTaken",
  forbidden: "auth.errors.forbidden",
  network: "auth.errors.network",
  unknown: "auth.errors.generic",
};

export function normalizeAuthError(error: unknown): NormalizedAuthError {
  if (error instanceof AuthApiError) {
    return { code: error.authCode, messageKey: MESSAGE_KEYS[error.authCode] };
  }

  if (error instanceof ApiError) {
    // Honor a known domain code delivered in the API error body.
    if (isAuthErrorCode(error.code)) {
      return { code: error.code, messageKey: MESSAGE_KEYS[error.code] };
    }
    if (error.code === "network" || error.status === 0) {
      return { code: "network", messageKey: MESSAGE_KEYS.network };
    }
    if (error.status === 401) {
      return { code: "invalid_credentials", messageKey: MESSAGE_KEYS.invalid_credentials };
    }
    if (error.status === 429) {
      return { code: "rate_limited", messageKey: MESSAGE_KEYS.rate_limited };
    }
    return { code: "unknown", messageKey: MESSAGE_KEYS.unknown };
  }

  // Fetch-level network failures (offline, DNS) surface as TypeErrors.
  if (error instanceof TypeError) {
    return { code: "network", messageKey: MESSAGE_KEYS.network };
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    // Aborted requests are control flow, not user-facing errors.
    return { code: "unknown", messageKey: MESSAGE_KEYS.unknown };
  }

  return { code: "unknown", messageKey: MESSAGE_KEYS.unknown };
}

export function isSessionExpired(error: unknown): boolean {
  return normalizeAuthError(error).code === "session_expired";
}
