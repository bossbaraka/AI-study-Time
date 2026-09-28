/**
 * Composition root — the ONLY module that wires engines to adapters.
 *
 * Before this module existed the engines imported each other directly:
 *
 *   execution-engine ─▶ roadmap-engine ─▶ goal-engine ─▶ assessment-engine
 *
 * Each engine now depends on a PORT (`services/ports`) and this file
 * decides which implementation satisfies it. No engine module imports
 * another engine module any more.
 *
 *   Execution Domain → RoadmapLookup → GoalLookup → AssessmentResultSource
 *
 * Adapters are chosen by runtime, not by the domain:
 *   - server (route handlers)  → in-memory stores (Phase 2 → Prisma)
 *   - browser / jsdom          → localStorage stores (the mock runtime)
 *
 * Names keep the historical `mock*` prefix so the ~20 existing import
 * sites changed path only, never identifiers. The engines themselves are
 * the real domain orchestrators — only their STORAGE is mock.
 */

import { createAssessmentEngine } from "@/services/assessment/mock-assessment-engine";
import { createExecutionEngine } from "@/services/execution/mock-execution-engine";
import { createGoalEngine } from "@/services/goals/mock-goal-engine";
import { createRoadmapEngine } from "@/services/roadmap/mock-roadmap-engine";
import { createStores, type StoreBackend } from "@/services/infrastructure";
import type { AssessmentResultSource } from "@/services/ports/lookups";

/** Server-side rendering and API routes have no `window`. */
const backend: StoreBackend = typeof window === "undefined" ? "memory" : "localStorage";

export const stores = createStores(backend);

export const mockAssessmentEngine = createAssessmentEngine({
  sessions: stores.assessmentSessions,
});

export const mockGoalEngine = createGoalEngine({ goals: stores.goals });

/** `goals` is satisfied by the goal engine — through the port, not an import. */
export const mockRoadmapEngine = createRoadmapEngine({
  roadmaps: stores.roadmaps,
  goals: mockGoalEngine,
});

/** `roadmaps` is satisfied by the roadmap engine — through the port. */
export const mockExecutionEngine = createExecutionEngine({
  executions: stores.executions,
  roadmaps: mockRoadmapEngine,
});

/**
 * Latest diagnosis for a student.
 *
 * Under Vitest the assessment engine runs in-process, so the source reads
 * it directly. In the browser the assessment domain is served by API
 * routes (server-authoritative evaluation), so the source crosses HTTP —
 * an infrastructure concern, kept out of the goal engine.
 */
export const assessmentResultSource: AssessmentResultSource = {
  async getLatestCompletedResult(studentId) {
    if (process.env.VITEST) {
      return mockAssessmentEngine.getLatestCompletedResult(studentId);
    }
    const response = await fetch("/api/assessment/results/latest", {
      credentials: "include",
    });
    if (!response.ok) return null;
    void studentId; // Ownership is enforced server-side from the session cookie.
    return (await response.json()) as Awaited<
      ReturnType<AssessmentResultSource["getLatestCompletedResult"]>
    >;
  },
};

/** Test seam: clears every engine's persisted state in one call. */
export function resetAllEngines(): void {
  stores.resetAll();
}
