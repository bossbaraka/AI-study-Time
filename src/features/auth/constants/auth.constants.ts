/**
 * Auth constants. Route paths are referenced by name everywhere so a
 * routing-convention change is a one-file edit.
 */

export const AUTH_ROUTES = {
  login: "/sign-in",
  register: "/sign-up",
  registerComplete: "/sign-up/complete",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  verifyEmail: "/verify-email",
} as const;

export type AuthRouteKey = keyof typeof AUTH_ROUTES;

/** Query parameter used to preserve the intended destination across login. */
export const NEXT_PARAM = "next";

/**
 * Password policy — firm but not hostile.
 * Length + mixed character classes; no arbitrary symbol mandates.
 */
export const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 72,
  requireLetter: true,
  requireNumber: true,
} as const;

/** Common breached passwords rejected outright. */
export const PASSWORD_DENYLIST: readonly string[] = [
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "qwerty123",
  "letmein1",
  "welcome1",
  "abc12345",
  "iloveyou1",
];

/** Client-side session lifetime for the mock backend (ms). Real value comes from the API. */
export const MOCK_SESSION_TTL_MS = 30 * 60 * 1000;

/** Namespaced storage keys — all auth storage lives behind the service. */
export const AUTH_STORAGE_KEYS = {
  session: "mureeh.auth.session",
} as const;
