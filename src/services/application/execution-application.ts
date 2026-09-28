/**
 * Execution application service — the server-side coordinator for execution routes.
 *
 * Route → **this** → execution engine → `ExecutionStore` port → Prisma.
 *
 * Dependency gating, attempt rules and the development evaluation are the
 * engine's. A client cannot reach a unit whose prerequisites are unpassed by
 * shaping a payload: the engine resolves the student's active roadmap and the
 * unit's position in it before it will start anything.
 *
 * **Server-only.**
 */

import { mockExecutionEngine as executionEngine } from "@/services/engines.server";
import type {
  LearningUnitExecution,
  RoadmapExecutionView,
  UnitLearningContext,
} from "@/types/execution";
import type { EvidenceInput } from "@/types/execution";

export const executionApplication = {
  /** Runtime view over the student's ACTIVE roadmap — null when none exists. */
  getExecutionView(studentId: string): Promise<RoadmapExecutionView | null> {
    return executionEngine.getExecutionView(studentId);
  },

  /** Everything the learn screen needs for one unit, resolved server-side. */
  getUnitContext(learningUnitId: string, studentId: string): Promise<UnitLearningContext> {
    return executionEngine.getUnitContext(learningUnitId, studentId);
  },

  /** Starts (or resumes/retries) a unit. Idempotent: never duplicates. */
  startLearningUnit(learningUnitId: string, studentId: string): Promise<LearningUnitExecution> {
    return executionEngine.startLearningUnit(learningUnitId, studentId);
  },

  /**
   * Records the student's evidence. The verdict is NOT accepted from the
   * client — `submitEvidence` stores the text and `evaluateExecution` derives
   * the result deterministically from the evidence policy.
   */
  submitEvidence(
    learningUnitId: string,
    input: EvidenceInput,
    studentId: string,
  ): Promise<LearningUnitExecution> {
    return executionEngine.submitEvidence(learningUnitId, input, studentId);
  },

  evaluateExecution(learningUnitId: string, studentId: string): Promise<LearningUnitExecution> {
    return executionEngine.evaluateExecution(learningUnitId, studentId);
  },
};
