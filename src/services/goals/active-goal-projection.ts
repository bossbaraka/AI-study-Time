/**
 * Active-goal projection (§6) — resolves the Phase 5 divergence between
 * the goal engine and the legacy `db.goal` dashboard mock.
 *
 * Student → Active Locked Goal → Active Roadmap: there is ONE
 * authoritative active goal. When the student has locked a real goal,
 * dashboard surfaces (sidebar, /app, /app/goal, /app/progress) project
 * it into the legacy `Goal` shape; otherwise the seeded mock remains as
 * a graceful fallback. Nothing is destructively rewritten.
 *
 * In the real-backend phase this projection moves server-side; the
 * dashboard contract (`Goal`) does not change.
 */

import { authService } from "@/services/auth.service";
import { mockGoalEngine } from "@/services/engines";
import type { Goal } from "@/types/domain";
import type { LearningGoal } from "@/types/goal";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Projects a locked LearningGoal into the legacy dashboard Goal shape. */
export function projectLockedGoal(goal: LearningGoal): Goal {
  const lockedAt = goal.lockedAt ?? goal.updatedAt;
  const targetDate = new Date(
    new Date(lockedAt).getTime() + goal.timeframe.weeks * MS_PER_WEEK,
  ).toISOString();
  return {
    id: goal.id,
    title: goal.desiredOutcome,
    description: goal.motivation.note ?? "",
    locked: true,
    lockedAt,
    targetDate,
    // Honest: no execution engine exists yet, so nothing has progressed.
    overallProgress: 0,
    weeklyCommitmentHours: goal.weeklyCommitment.hoursPerWeek,
  };
}

/**
 * The authoritative active goal for dashboard surfaces, or null when the
 * session has no locked goal (callers fall back to the seeded mock).
 */
export async function getAuthoritativeDashboardGoal(): Promise<Goal | null> {
  const state = await authService.getSessionState();
  if (state.status !== "authenticated" || !state.session) return null;
  if (state.session.user.role !== "student") return null;
  const active = await mockGoalEngine.getActiveGoal(state.session.user.id);
  if (!active || active.status !== "locked") return null;
  return projectLockedGoal(active);
}
