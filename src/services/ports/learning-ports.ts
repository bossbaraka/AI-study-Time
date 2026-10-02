/**
 * Intelligence ports — new learning substrate.
 *
 * Each port is minimal, async, and infrastructure-free.
 * Domain engines receive these; they never import Prisma, pg,
 * or HTTP. Two adapters exist per port:
 *   - memory (tests, browser fallback)
 *   - pg (production via Pool — Prisma delegates not yet generated)
 */

import type { Concept } from "@/types/concept";
import type { LearningEvent, CreateLearningEventInput } from "@/types/learning-event";
import type { Evidence, CreateEvidenceInput } from "@/types/evidence";
import type { ConceptState } from "@/types/concept-state";
import type { RecallSchedule } from "@/types/recall";
import type { TestAttempt, TestDefinition, TestAnswerInput } from "@/types/test-attempt";

// ------------------------------------------------------------------
// Concept
// ------------------------------------------------------------------
export interface ConceptStore {
  list(): Promise<Concept[]>;
  findById(id: string): Promise<Concept | undefined>;
  findByDomain(domain: string): Promise<Concept[]>;
  upsert(concept: Concept): Promise<void>;
  clear(): Promise<void>;
}

// ------------------------------------------------------------------
// LearningEvent (append-only)
// ------------------------------------------------------------------
export interface LearningEventStore {
  append(input: CreateLearningEventInput): Promise<LearningEvent>;
  listByStudent(studentId: string, limit?: number): Promise<LearningEvent[]>;
  listByStudentAndType(studentId: string, type: string, limit?: number): Promise<LearningEvent[]>;
  listByCorrelation(correlationId: string): Promise<LearningEvent[]>;
  clear(): Promise<void>;
}

// ------------------------------------------------------------------
// Evidence (generalized)
// ------------------------------------------------------------------
export interface EvidenceStore {
  create(studentId: string, input: CreateEvidenceInput): Promise<Evidence>;
  listByStudent(studentId: string, limit?: number): Promise<Evidence[]>;
  listByConcept(studentId: string, conceptId: string, limit?: number): Promise<Evidence[]>;
  findById(id: string): Promise<Evidence | undefined>;
  clear(): Promise<void>;
}

// ------------------------------------------------------------------
// ConceptState (per-student, per-concept)
// ------------------------------------------------------------------
export interface ConceptStateStore {
  get(studentId: string, conceptId: string): Promise<ConceptState | undefined>;
  listByStudent(studentId: string): Promise<ConceptState[]>;
  upsert(state: ConceptState): Promise<void>;
  clear(): Promise<void>;
}

// ------------------------------------------------------------------
// Recall
// ------------------------------------------------------------------
export interface RecallScheduleStore {
  get(studentId: string, conceptId: string): Promise<RecallSchedule | undefined>;
  listDue(studentId: string, nowIso?: string): Promise<RecallSchedule[]>;
  listByStudent(studentId: string): Promise<RecallSchedule[]>;
  upsert(schedule: RecallSchedule): Promise<void>;
  clear(): Promise<void>;
}

// ------------------------------------------------------------------
// Tests (server-authoritative)
// ------------------------------------------------------------------
export interface TestStore {
  listDefinitions(): Promise<TestDefinition[]>;
  findDefinitionById(id: string): Promise<TestDefinition | undefined>;
  upsertDefinition(def: TestDefinition): Promise<void>;
  createAttempt(attempt: TestAttempt): Promise<void>;
  listAttemptsByStudent(studentId: string): Promise<TestAttempt[]>;
  findAttemptById(id: string): Promise<TestAttempt | undefined>;
  clear(): Promise<void>;
}
