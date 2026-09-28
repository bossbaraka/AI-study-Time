/**
 * Cross-domain lookup ports.
 *
 * These break the previous hard import chain:
 *
 *   execution-engine ─▶ roadmap-engine ─▶ goal-engine ─▶ assessment-engine
 *
 * Each engine now depends on a PORT. The composition root
 * (`src/services/engines.ts`) decides which implementation satisfies it,
 * so no engine module imports another engine module.
 *
 * Target shape (see docs/ARCHITECTURE_AUDIT.md §8):
 *
 *   Execution Domain → RoadmapLookup → GoalLookup → AssessmentResultSource
 */

import type { AssessmentResult } from "@/types/assessment";
import type { LearningGoal } from "@/types/goal";
import type { Roadmap } from "@/types/roadmap";

/**
 * Read side of the goal domain, consumed by the roadmap engine.
 *
 * Throws the goal domain's own typed error (`goal_not_found`) when the
 * goal does not exist OR belongs to another student — the two cases are
 * intentionally indistinguishable.
 */
export interface GoalLookup {
  getGoal(goalId: string, studentId: string): LearningGoal;
}

/** Read side of the roadmap domain, consumed by the execution engine. */
export interface RoadmapLookup {
  getActiveRoadmap(studentId: string): Roadmap | null;
}

/**
 * The latest completed diagnosis for a student.
 *
 * Async because the implementation may cross a process boundary (the
 * assessment domain is served by API routes). Resolved by the
 * APPLICATION layer and handed to the goal engine as input — the goal
 * engine itself never fetches it, so it stays free of transport concerns.
 */
export interface AssessmentResultSource {
  getLatestCompletedResult(studentId: string): Promise<AssessmentResult | null>;
}
