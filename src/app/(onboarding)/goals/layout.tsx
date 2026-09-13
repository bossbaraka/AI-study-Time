"use client";

import { RequireAuth } from "@/features/auth/components/require-auth";

/**
 * Goal discovery belongs to a signed-in student (§16). Ownership is
 * enforced twice: this guard gates the route, and the goal engine derives
 * `studentId` from the auth session — never from client input.
 */
export default function GoalsLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth allowRoles={["student"]}>{children}</RequireAuth>;
}
