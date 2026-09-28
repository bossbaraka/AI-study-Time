/**
 * Engine composition, with no infrastructure opinion attached.
 *
 * This module knows how to wire the four engines to a set of persistence
 * ports and nothing else. It imports no Prisma client, no `localStorage` and
 * no HTTP — which is what lets two different composition roots share it:
 *
 *   - `engines.ts`        browser + tests  → in-memory / localStorage
 *   - `engines.server.ts` API routes + SSR → PostgreSQL through Prisma
 *
 * Keeping the wiring in one place means the server and the mock runtime run
 * the *same* domain logic against different storage, instead of two copies
 * that can drift.
 */

import { createAssessmentEngine } from "@/services/assessment/mock-assessment-engine";
import { createExecutionEngine } from "@/services/execution/mock-execution-engine";
import { createGoalEngine } from "@/services/goals/mock-goal-engine";
import { createRoadmapEngine } from "@/services/roadmap/mock-roadmap-engine";
import type { AssessmentResultSource } from "@/services/ports/lookups";
import type {
  AssessmentSessionStore,
  ExecutionStore,
  GoalStore,
  RoadmapStore,
} from "@/services/ports/stores";

export interface ComposableStores {
  assessmentSessions: AssessmentSessionStore;
  goals: GoalStore;
  roadmaps: RoadmapStore;
  executions: ExecutionStore;
}

export interface ComposedEngines {
  assessment: ReturnType<typeof createAssessmentEngine>;
  goal: ReturnType<typeof createGoalEngine>;
  roadmap: ReturnType<typeof createRoadmapEngine>;
  execution: ReturnType<typeof createExecutionEngine>;
  assessmentResultSource: AssessmentResultSource;
}

/**
 * @param diagnosisViaHttp  How the goal engine reaches the latest diagnosis.
 *
 * Server-side, the assessment engine is in the same process, so the source
 * reads it directly. In the browser the assessment domain is served by API
 * routes (evaluation is server-authoritative), so the source has to cross
 * HTTP. Deciding that here — rather than sniffing `process.env` inside the
 * engine — keeps an infrastructure choice out of the domain, and stops the
 * server composition from ever attempting a relative `fetch` to itself.
 */
export function composeEngines(
  stores: ComposableStores,
  options: { diagnosisViaHttp: boolean },
): ComposedEngines {
  const assessment = createAssessmentEngine({ sessions: stores.assessmentSessions });

  const goal = createGoalEngine({ goals: stores.goals });

  /** `goals` is satisfied by the goal engine — through the port, not an import. */
  const roadmap = createRoadmapEngine({ roadmaps: stores.roadmaps, goals: goal });

  /** `roadmaps` is satisfied by the roadmap engine — through the port. */
  const execution = createExecutionEngine({ executions: stores.executions, roadmaps: roadmap });

  const assessmentResultSource: AssessmentResultSource = {
    async getLatestCompletedResult(studentId) {
      if (!options.diagnosisViaHttp) {
        return assessment.getLatestCompletedResult(studentId);
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

  return { assessment, goal, roadmap, execution, assessmentResultSource };
}
