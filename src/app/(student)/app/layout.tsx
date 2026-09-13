import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { RequireAuth } from "@/features/auth/components/require-auth";

/**
 * Protected student application.
 * RequireAuth handles loading / unauthenticated / expired / unverified /
 * wrong-role states; `allowRoles` is UX routing, not authorization —
 * the backend remains the security boundary.
 */
export default function StudentAppLayout({ children }: { children: ReactNode }) {
  return (
    <RequireAuth allowRoles={["student"]}>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
