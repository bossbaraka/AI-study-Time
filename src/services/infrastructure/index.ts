/**
 * Concrete wiring of the persistence ports.
 *
 * `createStores("memory")`  → server runtime and tests (Node-safe).
 * `createStores("localStorage")` → the browser mock runtime.
 *
 * Phase 2 adds `createPrismaStores()` here behind the same ports; no
 * engine changes.
 */

import {
  createLocalStorageCollection,
  createMemoryCollection,
  type CollectionStore,
} from "@/services/infrastructure/collection-store";
import type {
  AssessmentSessionStore,
  ExecutionStore,
  GoalStore,
  RoadmapStore,
  StoredAssessmentSession,
} from "@/services/ports/stores";
import type { LearningUnitExecution } from "@/types/execution";
import type { LearningGoal } from "@/types/goal";
import type { Roadmap } from "@/types/roadmap";

export type StoreBackend = "memory" | "localStorage";

/** Bumped from v1: the stored assessment shape gained `studentId`. */
const ASSESSMENT_KEY = "mureeh.mock.assessment.v2";
const GOALS_KEY = "mureeh.mock.goals.v1";
const ROADMAPS_KEY = "mureeh.mock.roadmaps.v1";
const EXECUTIONS_KEY = "mureeh.mock.executions.v1";

export interface DomainStores {
  assessmentSessions: AssessmentSessionStore;
  goals: GoalStore;
  roadmaps: RoadmapStore;
  executions: ExecutionStore;
  /** Test seam: clears every backend collection. */
  resetAll(): void;
}

function backend<T extends { id: string }>(
  kind: StoreBackend,
  key: string,
): CollectionStore<T> {
  return kind === "localStorage"
    ? createLocalStorageCollection<T>(key)
    : createMemoryCollection<T>();
}

export function createStores(kind: StoreBackend): DomainStores {
  const sessions = backend<StoredAssessmentSession>(kind, ASSESSMENT_KEY);
  const goals = backend<LearningGoal>(kind, GOALS_KEY);
  const roadmaps = backend<Roadmap>(kind, ROADMAPS_KEY);
  const executions = backend<LearningUnitExecution>(kind, EXECUTIONS_KEY);

  return {
    // The collection backends are synchronous; the ports are async because
    // the Prisma adapters are. Wrapping here keeps that difference inside
    // the infrastructure layer.
    assessmentSessions: {
      listByStudent: async (studentId) =>
        sessions.list().filter((session) => session.studentId === studentId),
      findById: async (id) => sessions.findById(id),
      upsert: async (session) => sessions.upsert(session),
      clear: async () => sessions.clear(),
    },
    goals: {
      listByStudent: async (studentId) => goals.list().filter((goal) => goal.studentId === studentId),
      findById: async (id) => goals.findById(id),
      upsert: async (goal) => goals.upsert(goal),
      clear: async () => goals.clear(),
    },
    roadmaps: {
      listByStudent: async (studentId) =>
        roadmaps.list().filter((roadmap) => roadmap.studentId === studentId),
      findById: async (id) => roadmaps.findById(id),
      upsert: async (roadmap) => roadmaps.upsert(roadmap),
      clear: async () => roadmaps.clear(),
    },
    executions: {
      listByRoadmap: async (roadmapId) =>
        executions.list().filter((execution) => execution.roadmapId === roadmapId),
      list: async () => executions.list(),
      upsert: async (execution) => executions.upsert(execution),
      clear: async () => executions.clear(),
    },
    resetAll: () => {
      sessions.clear();
      goals.clear();
      roadmaps.clear();
      executions.clear();
    },
  };
}
