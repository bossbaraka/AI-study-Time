/**
 * Intelligence stores composition.
 *
 * Mirrors `src/services/infrastructure/index.ts` but for the
 * learning-intelligence substrate (concepts, events, evidence,
 * states, recall, tests). Two backends:
 *   - memory   → tests / Vitest (deterministic, fast)
 *   - pg       → production (Pool, real PostgreSQL)
 *
 * The domain never sees this choice.
 */
import {
  createMemoryConceptStore,
  createMemoryLearningEventStore,
  createMemoryEvidenceStore,
  createMemoryConceptStateStore,
  createMemoryRecallStore,
  createMemoryTestStore,
} from "./memory-learning-stores";
import {
  createPgConceptStore,
  createPgLearningEventStore,
  createPgEvidenceStore,
  createPgConceptStateStore,
  createPgRecallStore,
  createPgTestStore,
} from "./pg-learning-stores";

export type IntelligenceBackend = "memory" | "pg";

export interface IntelligenceStores {
  concepts: ReturnType<typeof createMemoryConceptStore>;
  learningEvents: ReturnType<typeof createMemoryLearningEventStore>;
  evidences: ReturnType<typeof createMemoryEvidenceStore>;
  conceptStates: ReturnType<typeof createMemoryConceptStateStore>;
  recallSchedules: ReturnType<typeof createMemoryRecallStore>;
  tests: ReturnType<typeof createMemoryTestStore>;
  resetAll(): Promise<void> | void;
}

export function createIntelligenceStores(backend: IntelligenceBackend): IntelligenceStores {
  if (backend === "memory") {
    const concepts = createMemoryConceptStore();
    const learningEvents = createMemoryLearningEventStore();
    const evidences = createMemoryEvidenceStore();
    const conceptStates = createMemoryConceptStateStore();
    const recallSchedules = createMemoryRecallStore();
    const tests = createMemoryTestStore();
    return {
      concepts,
      learningEvents,
      evidences,
      conceptStates,
      recallSchedules,
      tests,
      resetAll() {
        void concepts.clear();
        void learningEvents.clear();
        void evidences.clear();
        void conceptStates.clear();
        void recallSchedules.clear();
        void tests.clear();
      },
    };
  }

  const concepts = createPgConceptStore();
  const learningEvents = createPgLearningEventStore();
  const evidences = createPgEvidenceStore();
  const conceptStates = createPgConceptStateStore();
  const recallSchedules = createPgRecallStore();
  const tests = createPgTestStore();
  return {
    concepts,
    learningEvents,
    evidences,
    conceptStates,
    recallSchedules,
    tests,
    async resetAll() {
      await tests.clear();
      await recallSchedules.clear();
      await evidences.clear();
      await conceptStates.clear();
      await learningEvents.clear();
      // Do not clear concepts in prod reset — they are catalog, not per-test data.
      // Tests that need isolated concepts should use memory backend.
    },
  };
}

// Singletons
import type { IntelligenceStores as IS } from "./intelligence-stores";
const globalForIntel = globalThis as unknown as { mureehIntelligenceStores?: IS };

export function getIntelligenceStores(): IntelligenceStores {
  if (!globalForIntel.mureehIntelligenceStores) {
    const backend: IntelligenceBackend = process.env.VITEST ? "memory" : "pg";
    globalForIntel.mureehIntelligenceStores = createIntelligenceStores(backend);
  }
  return globalForIntel.mureehIntelligenceStores;
}
