/**
 * Wires the four Prisma adapters to the Phase 1 persistence ports.
 *
 * This is the only place in the application where a `PrismaClient` meets the
 * domain. Engines receive `AssessmentSessionStore` / `GoalStore` /
 * `RoadmapStore` / `ExecutionStore` and cannot tell whether they are backed by
 * PostgreSQL or by the in-memory collections used in tests — which is the
 * whole reason the ports exist.
 */
import type { PrismaClient } from "@prisma/client";

import type {
  AssessmentSessionStore,
  ExecutionStore,
  GoalStore,
  RoadmapStore,
} from "@/services/ports/stores";

import { PrismaAssessmentSessionStore } from "./session-store";
import { PrismaExecutionStore } from "./execution-store";
import { PrismaGoalStore } from "./goal-store";
import { PrismaRoadmapStore } from "./roadmap-store";

export interface PrismaDomainStores {
  assessmentSessions: AssessmentSessionStore;
  goals: GoalStore;
  roadmaps: RoadmapStore;
  executions: ExecutionStore;
  /**
   * Test seam. Unlike the in-memory `resetAll()` this has to await, because
   * truncating tables is I/O.
   */
  resetAll(): Promise<void>;
}

export function createPrismaStores(prisma: PrismaClient): PrismaDomainStores {
  const assessmentSessions = new PrismaAssessmentSessionStore(prisma);
  const goals = new PrismaGoalStore(prisma);
  const roadmaps = new PrismaRoadmapStore(prisma);
  const executions = new PrismaExecutionStore(prisma);

  return {
    assessmentSessions,
    goals,
    roadmaps,
    executions,
    // Order matters: executions reference learning units, and goals cascade
    // to roadmaps, so children are cleared before parents.
    resetAll: async () => {
      await executions.clear();
      await roadmaps.clear();
      await goals.clear();
      await assessmentSessions.clear();
    },
  };
}

export { PrismaAssessmentSessionStore, PrismaExecutionStore, PrismaGoalStore, PrismaRoadmapStore };
