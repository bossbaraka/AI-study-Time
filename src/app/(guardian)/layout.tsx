import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { RequireAuth } from "@/features/auth/components/require-auth";
import { serverUser } from "@/lib/server/auth/request";

/**
 * Protected guardian area.
 *
 * Server-side authorization first (real session → role, resolved against
 * the gateway): a guardian-role mismatch is bounced before any data or
 * markup renders. RequireAuth keeps the client-side UX states (loading,
 * expiry notices) — the UI guard is never the security boundary.
 */
export default async function GuardianLayout({ children }: { children: ReactNode }) {
  const user = await serverUser();
  if (user && user.role !== "guardian" && user.role !== "admin") {
    redirect("/sign-in?next=/guardian");
  }
  return <RequireAuth allowRoles={["guardian"]}>{children}</RequireAuth>;
}
