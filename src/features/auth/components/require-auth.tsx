"use client";

import { Loader2, ShieldAlert } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/features/auth/hooks/use-auth";
import {
  homeRouteForRole,
  loginUrlWithNext,
} from "@/features/auth/lib/destination";
import { AUTH_ROUTES, NEXT_PARAM } from "@/features/auth/constants/auth.constants";
import { useT } from "@/lib/i18n/provider";
import type { UserRole } from "@/types/auth";

export interface RequireAuthProps {
  children: ReactNode;
  /** Roles permitted in this area. Frontend UX routing only — never authorization. */
  allowRoles?: UserRole[];
}

/**
 * Protected-route guard.
 *
 * Handles every state without redirect loops:
 * - loading          → calm full-screen pending state
 * - unauthenticated  → login, preserving the intended destination (?next=)
 * - session expired  → login with an "expired" notice
 * - email unverified → verification screen (with ?next= carried forward)
 * - wrong role       → that role's home (which itself allows the role)
 * - authorized       → render children
 */
export function RequireAuth({ children, allowRoles }: RequireAuthProps) {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname();
  const { status, user, isSessionExpired } = useAuth();

  useEffect(() => {
    if (status === "loading" || !user) {
      if (status === "unauthenticated") {
        router.replace(loginUrlWithNext(pathname, isSessionExpired));
      }
      return;
    }

    if (user.emailVerification !== "verified") {
      const params = new URLSearchParams({ [NEXT_PARAM]: pathname });
      router.replace(`${AUTH_ROUTES.verifyEmail}?${params.toString()}`);
      return;
    }

    if (allowRoles && !allowRoles.includes(user.role)) {
      router.replace(homeRouteForRole(user.role));
    }
  }, [status, user, isSessionExpired, pathname, allowRoles, router]);

  if (status === "loading") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background"
      >
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("auth.session.checking")}</p>
      </div>
    );
  }

  // Redirects in flight: render nothing rather than flashing protected content.
  if (!user) return null;
  if (user.emailVerification !== "verified") return null;
  if (allowRoles && !allowRoles.includes(user.role)) {
    return (
      <div
        role="alert"
        className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center"
      >
        <span className="flex size-12 items-center justify-center rounded-full border border-warning/35 bg-warning-subtle text-warning">
          <ShieldAlert className="size-6" aria-hidden="true" />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{t("auth.unauthorized.title")}</h1>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            {t("auth.unauthorized.body")}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
