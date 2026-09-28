/**
 * Authentication & identity domain types.
 *
 * `UserRole` is re-exported from the existing domain model rather than
 * redeclared — one source of truth for role naming across the app.
 */

import type { UserRole } from "@/types/domain";

export type { UserRole };

/** Result of resolving the current session on app/route entry. */
export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

/**
 * Verification state is deliberately separate from `AuthStatus`:
 * a user can be authenticated and still unverified.
 */
export type EmailVerificationState = "unverified" | "pending" | "verified";

/**
 * Onboarding state drives post-auth routing.
 * STEP 3 owns the onboarding screens; STEP 2 only routes on this value.
 */
export type OnboardingState = "not-started" | "in-progress" | "completed";

/**
 * The public identity surface. Tokens are intentionally absent —
 * components never receive or handle credentials or session tokens.
 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  emailVerification: EmailVerificationState;
  onboarding: OnboardingState;
}

export interface Session {
  user: AuthUser;
  /** ISO timestamps. Expiry is evaluated by the service, not by components. */
  issuedAt: string;
  expiresAt: string;
}

export interface SessionState {
  status: AuthStatus;
  session: Session | null;
  /** True when a previously valid session lapsed — drives the "sign in again" notice. */
  expired: boolean;
}

/* ------------------------------------------------------------------ */
/* Payloads                                                            */
/* ------------------------------------------------------------------ */

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  /** Institutional invitation code — required by the real auth gateway. */
  inviteCode?: string;
  /** Optional national identifier, validated server-side for uniqueness. */
  nationalId?: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export interface VerifyEmailPayload {
  token: string;
}

export interface ResendVerificationPayload {
  email: string;
}

/* ------------------------------------------------------------------ */
/* Responses                                                           */
/* ------------------------------------------------------------------ */

export interface AuthResponse {
  session: Session;
}

/** Registration never auto-signs-in; every invited account must verify its email. */
export type RegisterResponse = { status: "verification-required"; email: string };

/**
 * Password recovery responses are intentionally indistinguishable.
 * Exposing "no such account" would leak which emails are registered.
 */
export interface ForgotPasswordResponse {
  status: "submitted";
}

export interface ResetPasswordResponse {
  status: "reset";
}

export type VerifyEmailResult =
  | { status: "verified" }
  | { status: "already-verified" }
  | { status: "expired" }
  | { status: "invalid" };

export interface ResendVerificationResponse {
  status: "sent";
}

/* ------------------------------------------------------------------ */
/* Errors                                                              */
/* ------------------------------------------------------------------ */

/**
 * Stable, non-sensitive error codes. The normalization layer maps these
 * to translation keys; raw backend messages never reach the UI.
 */
export const AUTH_ERROR_CODES = [
  "invalid_credentials",
  "email_already_registered",
  "token_invalid",
  "token_expired",
  "email_already_verified",
  "unverified_email",
  "session_expired",
  "rate_limited",
  "account_locked",
  "account_suspended",
  "account_pending",
  "invitation_invalid",
  "invitation_expired",
  "identifier_taken",
  "forbidden",
  "network",
  "unknown",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

/** Runtime guard: narrows an arbitrary API error code to the known domain set. */
export function isAuthErrorCode(value: string | undefined): value is AuthErrorCode {
  return value !== undefined && (AUTH_ERROR_CODES as readonly string[]).includes(value);
}
