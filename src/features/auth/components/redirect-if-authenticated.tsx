"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { NEXT_PARAM } from "@/features/auth/constants/auth.constants";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { resolvePostAuthDestination } from "@/features/auth/lib/destination";
import { useT } from "@/lib/i18n/provider";

/**
 * Inverse guard for public auth screens: an already-authenticated user
 * is routed to where their session state says they belong — never shown
 * a login form they don't need.
 */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status, session } = useAuth();

  const nextParam = searchParams.get(NEXT_PARAM);

  useEffect(() => {
    if (status === "authenticated" && session) {
      router.replace(resolvePostAuthDestination(session, nextParam));
    }
  }, [status, session, nextParam, router]);

  if (status === "loading") {
    return (
      <div role="status" aria-live="polite" className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
        <span className="sr-only">{t("auth.session.checking")}</span>
      </div>
    );
  }

  if (status === "authenticated") return null;

  return <>{children}</>;
}
