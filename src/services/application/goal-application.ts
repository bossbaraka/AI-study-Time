/**
 * Goal application service — the server-side coordinator for goal routes.
 *
 * Route → **this** → goal engine → `GoalStore` port → Prisma → PostgreSQL.
 *
 * Its job is coordination, not rules. It resolves cross-domain inputs the
 * client must never supply, and hands typed domain objects to the engine.
 * Every goal-quality rule, every state transition and every ownership check
 * stays inside the engine.
 *
 * **Server-only.** It imports the Prisma-backed composition root.
 */

import { mockGoalEngine as goalEngine, assessmentResultSource } from "@/services/engines.server";
import type {
  GoalDiscoveryInput,
  GoalRefinePatch,
  GoalValidationResult,
  GoalWithValidation,
  LearningGoal,
} from "@/types/goal";

export const goalApplication = {
  /** The student's live goal, or null. */
  getActiveGoal(studentId: string): Promise<LearningGoal | null> {
    return goalEngine.getActiveGoal(studentId);
  },

  /** One goal by id. The engine answers 404/403 for foreign or missing ids. */
  getGoal(goalId: string, studentId: string): Promise<LearningGoal> {
    return goalEngine.getGoal(goalId, studentId);
  },

  /**
   * Creates (or replays) a goal.
   *
   * The diagnosis snapshot is resolved HERE, server-side, from the student's
   * latest completed assessment. Previously the browser resolved it and sent
   * it along — which meant a crafted request could attach an arbitrary
   * diagnosis to a goal and shape the roadmap it produces. The client sends
   * its input and a replay key; nothing else.
   */
  async createGoal(
    input: GoalDiscoveryInput,
    idempotencyKey: string,
    studentId: string,
  ): Promise<GoalWithValidation> {
    const diagnosisContext = await assessmentResultSource.getLatestCompletedResult(studentId);
    return goalEngine.createGoal(input, { studentId, idempotencyKey, diagnosisContext });
  },

  /** Student-driven refinement; the engine re-validates and returns the verdict. */
  updateGoal(
    goalId: string,
    patch: GoalRefinePatch,
    studentId: string,
  ): Promise<GoalWithValidation> {
    return goalEngine.updateGoal(goalId, studentId, patch);
  },

  /** Re-runs validation without mutating the goal. */
  validateGoal(goalId: string, studentId: string): Promise<GoalValidationResult> {
    return goalEngine.validateGoal(goalId, studentId);
  },

  /** Idempotent lock. The unique key on `(studentId, lockIdempotencyKey)`
   *  makes a concurrent double-lock impossible at the database level. */
  lockGoal(goalId: string, idempotencyKey: string, studentId: string): Promise<LearningGoal> {
    return goalEngine.lockGoal(goalId, studentId, idempotencyKey);
  },

  /** Explicit revision — the only way to edit a locked goal. */
  reviseGoal(goalId: string, studentId: string): Promise<GoalWithValidation> {
    return goalEngine.reviseGoal(goalId, studentId);
  },
};
