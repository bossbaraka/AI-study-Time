"use client";

import { RequireAuth } from "@/features/auth/components/require-auth";

/**
 * The roadmap belongs to a signed-in student (§28). The engine derives
 * `studentId` from the session; this guard only gates the route.
 */
export default function RoadmapLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth allowRoles={["student"]}>{children}</RequireAuth>;
}
