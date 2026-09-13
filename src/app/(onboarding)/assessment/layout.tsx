"use client";

import { RequireAuth } from "@/features/auth/components/require-auth";

/**
 * Assessment is a signed-in student experience. Reuses the STEP 2 guard —
 * loading / unauthenticated (with ?next=) / unverified / expired are all
 * handled there, so no redirect logic is duplicated here.
 */
export default function AssessmentLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth allowRoles={["student"]}>{children}</RequireAuth>;
}
