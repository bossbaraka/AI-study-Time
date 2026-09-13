/**
 * Post-authentication routing rules.
 *
 * Pure functions — no router, no side effects — so they are unit-testable
 * and shared by login, register, verification and the route guards.
 *
 * NOTE: these checks are UX routing, NOT authorization. The backend
 * remains the security boundary for every protected resource.
 */

import { AUTH_ROUTES, NEXT_PARAM } from "@/features/auth/constants/auth.constants";
import type { Session, UserRole } from "@/types/auth";

export const ROLE_HOME: Record<UserRole, string> = {
  student: "/app",
  guardian: "/guardian",
  admin: "/admin",
};

/** Onboarding entry point; STEP 3 owns the screens themselves. */
export const ONBOARDING_ENTRY = "/assessment";

/**
 * Only same-origin relative paths are accepted. Blocks `//evil.com`,
 * absolute URLs and anything else that could become an open redirect.
 */
export function sanitizeNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/")) return null;
  if (raw.startsWith("//")) return null;
  if (raw.includes("\\")) return null;
  try {
    const url = new URL(raw, "http://internal.invalid");
    if (url.origin !== "http://internal.invalid") return null;
  } catch {
    return null;
  }
  return raw;
}

/**
 * Resolve where an authenticated user belongs:
 * 1. explicit `next` destination (sanitized)
 * 2. unverified email → verification screen
 * 3. incomplete onboarding (students) → assessment entry
 * 4. role home
 */
export function resolvePostAuthDestination(
  session: Session,
  next?: string | null,
): string {
  const sanitized = sanitizeNext(next);

  if (session.user.emailVerification !== "verified") {
    return sanitized
      ? `${AUTH_ROUTES.verifyEmail}?${NEXT_PARAM}=${encodeURIComponent(sanitized)}`
      : AUTH_ROUTES.verifyEmail;
  }

  if (session.user.role === "student" && session.user.onboarding !== "completed") {
    return sanitized
      ? `${ONBOARDING_ENTRY}?${NEXT_PARAM}=${encodeURIComponent(sanitized)}`
      : ONBOARDING_ENTRY;
  }

  return sanitized ?? ROLE_HOME[session.user.role];
}

/** Where to send a user whose role does not match the area they requested. */
export function homeRouteForRole(role: UserRole): string {
  return ROLE_HOME[role];
}

/** Build the login URL preserving the intended destination + expiry notice. */
export function loginUrlWithNext(next: string, expired = false): string {
  const params = new URLSearchParams();
  const sanitized = sanitizeNext(next);
  if (sanitized) params.set(NEXT_PARAM, sanitized);
  if (expired) params.set("expired", "1");
  const query = params.toString();
  return query ? `${AUTH_ROUTES.login}?${query}` : AUTH_ROUTES.login;
}
