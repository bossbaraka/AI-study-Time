/**
 * In-memory adapters for intelligence ports — tests + Vitest
 * (Node-safe, no I/O, deterministic).
 */
import type {
  ConceptStore,
  LearningEventStore,
  EvidenceStore,
  ConceptStateStore,
  RecallScheduleStore,
  TestStore,
} from "@/services/ports/learning-ports";
import type { Concept } from "@/types/concept";
import type { LearningEvent, CreateLearningEventInput } from "@/types/learning-event";
import type { Evidence, CreateEvidenceInput } from "@/types/evidence";
import type { ConceptState } from "@/types/concept-state";
import type { RecallSchedule } from "@/types/recall";
import type { TestAttempt, TestDefinition } from "@/types/test-attempt";

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

// ------------------------------------------------------------------
// Concept
// ------------------------------------------------------------------
export function createMemoryConceptStore(seed?: Concept[]): ConceptStore {
  const rows: Concept[] = seed ? [...seed] : [];
  return {
    async list() { return [...rows]; },
    async findById(id) { return rows.find((r) => r.id === id); },
    async findByDomain(domain) { return rows.filter((r) => r.domain === domain); },
    async upsert(concept) {
      const i = rows.findIndex((r) => r.id === concept.id);
      if (i === -1) rows.push(concept); else rows[i] = concept;
    },
    async clear() { rows.length = 0; },
  };
}

// ------------------------------------------------------------------
// LearningEvent (append-only)
// ------------------------------------------------------------------
export function createMemoryLearningEventStore(): LearningEventStore {
  const rows: LearningEvent[] = [];
  return {
    async append(input: CreateLearningEventInput) {
      const ev: LearningEvent = {
        eventId: uid("ev"),
        studentId: input.studentId,
        type: input.type,
        timestamp: nowIso(),
        source: input.source,
        entityType: input.entityType,
        entityId: input.entityId,
        payload: input.payload ?? {},
        schemaVersion: input.schemaVersion ?? 1,
        correlationId: input.correlationId ?? null,
        createdAt: nowIso(),
      };
      rows.push(ev);
      return ev;
    },
    async listByStudent(studentId, limit = 100) {
      return rows.filter((r) => r.studentId === studentId).slice(-limit);
    },
    async listByStudentAndType(studentId, type, limit = 100) {
      return rows.filter((r) => r.studentId === studentId && r.type === type).slice(-limit);
    },
    async listByCorrelation(correlationId) {
      return rows.filter((r) => r.correlationId === correlationId);
    },
    async clear() { rows.length = 0; },
  };
}

// ------------------------------------------------------------------
// Evidence
// ------------------------------------------------------------------
export function createMemoryEvidenceStore(): EvidenceStore {
  const rows: Evidence[] = [];
  return {
    async create(studentId, input) {
      const ev: Evidence = {
        id: uid("evid"),
        studentId,
        conceptId: input.conceptId ?? null,
        kind: input.kind,
        payload: input.payload,
        score: input.score ?? null,
        timeSpentSeconds: input.timeSpentSeconds ?? null,
        attemptCount: input.attemptCount ?? 1,
        hintUsed: input.hintUsed ?? false,
        hintCount: input.hintCount ?? 0,
        learningUnitId: input.learningUnitId ?? null,
        roadmapId: input.roadmapId ?? null,
        assessmentSessionId: input.assessmentSessionId ?? null,
        testAttemptId: input.testAttemptId ?? null,
        immutable: false,
        version: 1,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      rows.push(ev);
      return ev;
    },
    async listByStudent(studentId, limit = 100) {
      return rows.filter((r) => r.studentId === studentId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    },
    async listByConcept(studentId, conceptId, limit = 100) {
      return rows.filter((r) => r.studentId === studentId && r.conceptId === conceptId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    },
    async findById(id) { return rows.find((r) => r.id === id); },
    async clear() { rows.length = 0; },
  };
}

// ------------------------------------------------------------------
// ConceptState
// ------------------------------------------------------------------
export function createMemoryConceptStateStore(): ConceptStateStore {
  const rows: ConceptState[] = [];
  return {
    async get(studentId, conceptId) { return rows.find((r) => r.studentId === studentId && r.conceptId === conceptId); },
    async listByStudent(studentId) { return rows.filter((r) => r.studentId === studentId); },
    async upsert(state) {
      const i = rows.findIndex((r) => r.studentId === state.studentId && r.conceptId === state.conceptId);
      if (i === -1) rows.push(state); else rows[i] = state;
    },
    async clear() { rows.length = 0; },
  };
}

// ------------------------------------------------------------------
// Recall
// ------------------------------------------------------------------
export function createMemoryRecallStore(): RecallScheduleStore {
  const rows: RecallSchedule[] = [];
  return {
    async get(studentId, conceptId) { return rows.find((r) => r.studentId === studentId && r.conceptId === conceptId); },
    async listDue(studentId, nowIsoArg) {
      const now = nowIsoArg ?? nowIso();
      return rows.filter((r) => r.studentId === studentId && r.dueAt <= now).sort((a,b)=>a.dueAt.localeCompare(b.dueAt));
    },
    async listByStudent(studentId) { return rows.filter((r) => r.studentId === studentId); },
    async upsert(schedule) {
      const i = rows.findIndex((r) => r.studentId === schedule.studentId && r.conceptId === schedule.conceptId);
      if (i === -1) rows.push(schedule); else rows[i] = schedule;
    },
    async clear() { rows.length = 0; },
  };
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------
export function createMemoryTestStore(): TestStore {
  const defs: TestDefinition[] = [];
  const attempts: TestAttempt[] = [];
  return {
    async listDefinitions() { return [...defs]; },
    async findDefinitionById(id) { return defs.find((d) => d.id === id); },
    async upsertDefinition(def) {
      const i = defs.findIndex((d) => d.id === def.id);
      if (i === -1) defs.push(def); else defs[i] = def;
    },
    async createAttempt(a) { attempts.push(a); },
    async listAttemptsByStudent(studentId) { return attempts.filter((a) => a.studentId === studentId); },
    async findAttemptById(id) { return attempts.find((a) => a.id === id); },
    async clear() { defs.length = 0; attempts.length = 0; },
  };
}
