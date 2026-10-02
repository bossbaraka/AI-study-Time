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
 * Intelligence hook: after evidence evaluation the result is fed to the
 * learning-intelligence pipeline (Evidence → ConceptState → Diagnosis →
 * Recall). This is fire-and-forget for the API response but awaited so
 * tests see the state consistently.
 *
 * **Server-only.**
 */

import { executionEngine } from "@/services/engines.server";
import { recordExecutionEvidence } from "@/services/application/intelligence-application";
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

  async evaluateExecution(learningUnitId: string, studentId: string): Promise<LearningUnitExecution> {
    const execution = await executionEngine.evaluateExecution(learningUnitId, studentId);
    // Fire intelligence pipeline (best-effort, but awaited for consistency)
    try {
      const ctx = await executionEngine.getUnitContext(learningUnitId, studentId);
      const scoreMap: Record<string, number> = { passed: 1, needs_review: 0.6, failed: 0.2 };
      const rawResult = execution.result as unknown;
      let score = 0.5;
      if (typeof rawResult === "string") score = scoreMap[rawResult] ?? 0.5;
      else if (rawResult && typeof rawResult === "object" && "kind" in (rawResult as Record<string, unknown>)) {
        // developmentEvaluator returns string directly; future evaluator may return object
        score = (rawResult as { score?: number }).score ?? 0.5;
      }
      // Resolve capabilityId from the milestone that owns this unit.
      // We have the roadmap and milestone ids via the execution record;
      // the canonical capability lives on RoadmapMilestone.capabilityId.
      let capabilityId = ctx.milestone.id;
      try {
        const { getPool } = await import("@/services/infrastructure/pg-pool");
        const pool = getPool();
        const { rows } = await pool.query(`SELECT "capabilityId" FROM "RoadmapMilestone" WHERE "id"=$1 LIMIT 1`, [execution.milestoneId]);
        if (rows[0]?.capabilityId) capabilityId = rows[0].capabilityId as string;
      } catch {
        // Fall back to the milestone id as capability hint
      }
      await recordExecutionEvidence({
        studentId,
        roadmapId: ctx.roadmap.id,
        learningUnitId,
        milestoneCapabilityId: capabilityId,
        score,
        solution: (execution.evidence as { solution?: string } | null)?.solution ?? "",
        reasoning: (execution.evidence as { reasoning?: string } | null)?.reasoning ?? "",
        correlationId: execution.id,
      });
    } catch {
      // Intelligence failure must not break the core execution path
    }
    return execution;
  },
};
