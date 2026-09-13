/**
 * Shared identity gate for student-owned services (§16/§28).
 *
 * `studentId` ALWAYS comes from the authenticated session — never from
 * client input. Services map the plain ApiError codes thrown here into
 * their own typed errors (GoalApiError / RoadmapApiError).
 */

import { ApiError } from "@/lib/api/client";
import { authService } from "@/services/auth.service";

export async function requireStudentId(): Promise<string> {
  const state = await authService.getSessionState();
  if (state.status !== "authenticated" || !state.session) {
    throw new ApiError("unauthenticated", 401, "unauthenticated");
  }
  if (state.session.user.role !== "student") {
    throw new ApiError("forbidden", 403, "forbidden");
  }
  return state.session.user.id;
}
