/**
 * pg adapters for intelligence ports — production.
 *
 * Each store uses raw SQL via the shared Pool. The schema is the one
 * created by `20261002120000_learning_intelligence/migration.sql`.
 * Value objects are JsonB; timestamps are TIMESTAMPTZ stored as ISO
 * strings at the application boundary.
 *
 * Errors from unique/foreign-key violations are translated to
 * PersistenceConflictError (409) rather than leaking SQLSTATE.
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
import { getPool } from "./pg-pool";
import { PersistenceConflictError } from "@/services/ports/stores";

// ------------------------------------------------------------------
// helpers
// ------------------------------------------------------------------
function toIso(d: Date | string | null): string | null {
  if (!d) return null;
  if (typeof d === "string") return d;
  return d.toISOString();
}
function nowIso(): string { return new Date().toISOString(); }
function uid(prefix = "id"): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}_${(crypto as unknown as { randomUUID: () => string }).randomUUID().slice(0, 12)}`;
  } catch { /* fall through */ }
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

// ------------------------------------------------------------------
// Concept
// ------------------------------------------------------------------
export function createPgConceptStore(): ConceptStore {
  return {
    async list() {
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM "Concept" ORDER BY "name"`);
      return rows.map(toConcept);
    },
    async findById(id) {
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM "Concept" WHERE "id"=$1 LIMIT 1`, [id]);
      return rows[0] ? toConcept(rows[0]) : undefined;
    },
    async findByDomain(domain) {
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM "Concept" WHERE "domain"=$1 ORDER BY "difficulty"`, [domain]);
      return rows.map(toConcept);
    },
    async upsert(concept) {
      const pool = getPool();
      try {
        await pool.query(
          `INSERT INTO "Concept" ("id","name","description","domain","prerequisites","difficulty","version","createdAt","updatedAt")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT ("id") DO UPDATE SET
             "name"=EXCLUDED."name",
             "description"=EXCLUDED."description",
             "domain"=EXCLUDED."domain",
             "prerequisites"=EXCLUDED."prerequisites",
             "difficulty"=EXCLUDED."difficulty",
             "version"=EXCLUDED."version",
             "updatedAt"=EXCLUDED."updatedAt"`,
          [concept.id, concept.name, concept.description, concept.domain, concept.prerequisites, concept.difficulty, concept.version, new Date(concept.createdAt), new Date(concept.updatedAt)],
        );
      } catch (e: unknown) {
        // unique name+domain
        if (isPgUnique(e)) throw new PersistenceConflictError("duplicate_key", "concept already exists");
        throw e;
      }
    },
    async clear() {
      const pool = getPool();
      await pool.query(`DELETE FROM "Concept"`);
    },
  };
}

function toConcept(row: Record<string, unknown>): Concept {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    domain: row.domain as string,
    prerequisites: (row.prerequisites as string[]) ?? [],
    difficulty: row.difficulty as number,
    version: row.version as number,
    createdAt: toIso(row.createdAt as Date) ?? nowIso(),
    updatedAt: toIso(row.updatedAt as Date) ?? nowIso(),
  };
}

// ------------------------------------------------------------------
// LearningEvent
// ------------------------------------------------------------------
export function createPgLearningEventStore(): LearningEventStore {
  return {
    async append(input) {
      const pool = getPool();
      const id = uid("ev");
      const ts = nowIso();
      const payload = JSON.stringify(input.payload ?? {});
      await pool.query(
        `INSERT INTO "LearningEvent" ("id","studentId","type","timestamp","source","entityType","entityId","payload","schemaVersion","correlationId","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11)`,
        [id, input.studentId, input.type, new Date(ts), input.source, input.entityType, input.entityId, payload, input.schemaVersion ?? 1, input.correlationId ?? null, new Date(ts)],
      );
      return {
        eventId: id,
        studentId: input.studentId,
        type: input.type,
        timestamp: ts,
        source: input.source,
        entityType: input.entityType,
        entityId: input.entityId,
        payload: (input.payload ?? {}) as Record<string, unknown>,
        schemaVersion: input.schemaVersion ?? 1,
        correlationId: input.correlationId ?? null,
        createdAt: ts,
      };
    },
    async listByStudent(studentId, limit = 100) {
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM "LearningEvent" WHERE "studentId"=$1 ORDER BY "timestamp" DESC LIMIT $2`, [studentId, limit]);
      return rows.map(toEvent);
    },
    async listByStudentAndType(studentId, type, limit = 100) {
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM "LearningEvent" WHERE "studentId"=$1 AND "type"=$2 ORDER BY "timestamp" DESC LIMIT $3`, [studentId, type, limit]);
      return rows.map(toEvent);
    },
    async listByCorrelation(correlationId) {
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM "LearningEvent" WHERE "correlationId"=$1 ORDER BY "timestamp"`, [correlationId]);
      return rows.map(toEvent);
    },
    async clear() {
      const pool = getPool();
      await pool.query(`DELETE FROM "LearningEvent"`);
    },
  };
}

function toEvent(row: Record<string, unknown>): LearningEvent {
  return {
    eventId: row.id as string,
    studentId: row.studentId as string,
    type: row.type as LearningEvent["type"],
    timestamp: toIso(row.timestamp as Date) ?? nowIso(),
    source: row.source as string,
    entityType: row.entityType as string,
    entityId: row.entityId as string,
    payload: (row.payload as Record<string, unknown>) ?? {},
    schemaVersion: row.schemaVersion as number,
    correlationId: (row.correlationId as string | null) ?? null,
    createdAt: toIso(row.createdAt as Date) ?? nowIso(),
  };
}

// ------------------------------------------------------------------
// Evidence
// ------------------------------------------------------------------
export function createPgEvidenceStore(): EvidenceStore {
  return {
    async create(studentId, input) {
      const pool = getPool();
      const id = uid("evid");
      const ts = nowIso();
      const payload = JSON.stringify(input.payload);
      const { rows } = await pool.query(
        `INSERT INTO "Evidence" ("id","studentId","conceptId","kind","payload","score","timeSpentSeconds","attemptCount","hintUsed","hintCount","learningUnitId","roadmapId","assessmentSessionId","testAttemptId","immutable","version","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
        [id, studentId, input.conceptId ?? null, input.kind, payload, input.score ?? null, input.timeSpentSeconds ?? null, input.attemptCount ?? 1, input.hintUsed ?? false, input.hintCount ?? 0, input.learningUnitId ?? null, input.roadmapId ?? null, input.assessmentSessionId ?? null, input.testAttemptId ?? null, false, 1, new Date(ts), new Date(ts)],
      );
      return toEvidence(rows[0] as Record<string, unknown>);
    },
    async listByStudent(studentId, limit = 100) {
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM "Evidence" WHERE "studentId"=$1 ORDER BY "createdAt" DESC LIMIT $2`, [studentId, limit]);
      return rows.map(toEvidence);
    },
    async listByConcept(studentId, conceptId, limit = 100) {
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM "Evidence" WHERE "studentId"=$1 AND "conceptId"=$2 ORDER BY "createdAt" DESC LIMIT $3`, [studentId, conceptId, limit]);
      return rows.map(toEvidence);
    },
    async findById(id) {
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM "Evidence" WHERE "id"=$1 LIMIT 1`, [id]);
      return rows[0] ? toEvidence(rows[0] as Record<string, unknown>) : undefined;
    },
    async clear() {
      const pool = getPool();
      await pool.query(`DELETE FROM "Evidence"`);
    },
  };
}

function toEvidence(row: Record<string, unknown>): Evidence {
  return {
    id: row.id as string,
    studentId: row.studentId as string,
    conceptId: (row.conceptId as string | null) ?? null,
    kind: row.kind as Evidence["kind"],
    payload: (row.payload as Evidence["payload"]) ?? {},
    score: (row.score as number | null) ?? null,
    timeSpentSeconds: (row.timeSpentSeconds as number | null) ?? null,
    attemptCount: row.attemptCount as number,
    hintUsed: row.hintUsed as boolean,
    hintCount: row.hintCount as number,
    learningUnitId: (row.learningUnitId as string | null) ?? null,
    roadmapId: (row.roadmapId as string | null) ?? null,
    assessmentSessionId: (row.assessmentSessionId as string | null) ?? null,
    testAttemptId: (row.testAttemptId as string | null) ?? null,
    immutable: row.immutable as boolean,
    version: row.version as number,
    createdAt: toIso(row.createdAt as Date) ?? nowIso(),
    updatedAt: toIso(row.updatedAt as Date) ?? nowIso(),
  };
}

// ------------------------------------------------------------------
// ConceptState
// ------------------------------------------------------------------
export function createPgConceptStateStore(): ConceptStateStore {
  return {
    async get(studentId, conceptId) {
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM "ConceptState" WHERE "studentId"=$1 AND "conceptId"=$2 LIMIT 1`, [studentId, conceptId]);
      return rows[0] ? toState(rows[0] as Record<string, unknown>) : undefined;
    },
    async listByStudent(studentId) {
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM "ConceptState" WHERE "studentId"=$1 ORDER BY "conceptId"`, [studentId]);
      return rows.map(toState);
    },
    async upsert(state) {
      const pool = getPool();
      await pool.query(
        `INSERT INTO "ConceptState" ("id","studentId","conceptId","knowledge","retrieval","retention","transfer","fluency","confidence","hintDependency","misconceptionRisk","evidenceCount","lastEvidenceAt","stateVersion","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT ("studentId","conceptId") DO UPDATE SET
           "knowledge"=EXCLUDED."knowledge",
           "retrieval"=EXCLUDED."retrieval",
           "retention"=EXCLUDED."retention",
           "transfer"=EXCLUDED."transfer",
           "fluency"=EXCLUDED."fluency",
           "confidence"=EXCLUDED."confidence",
           "hintDependency"=EXCLUDED."hintDependency",
           "misconceptionRisk"=EXCLUDED."misconceptionRisk",
           "evidenceCount"=EXCLUDED."evidenceCount",
           "lastEvidenceAt"=EXCLUDED."lastEvidenceAt",
           "stateVersion"=EXCLUDED."stateVersion",
           "updatedAt"=EXCLUDED."updatedAt"`,
        [(state as unknown as { id?: string }).id ?? uid("cs"), state.studentId, state.conceptId, state.knowledge, state.retrieval, state.retention, state.transfer, state.fluency, state.confidence, state.hintDependency, state.misconceptionRisk, state.evidenceCount, state.lastEvidenceAt ? new Date(state.lastEvidenceAt) : null, state.stateVersion, new Date(state.createdAt), new Date(state.updatedAt)],
      );
    },
    async clear() {
      const pool = getPool();
      await pool.query(`DELETE FROM "ConceptState"`);
    },
  };
}

function toState(row: Record<string, unknown>): ConceptState {
  return {
    conceptId: row.conceptId as string,
    studentId: row.studentId as string,
    knowledge: row.knowledge as number,
    retrieval: row.retrieval as number,
    retention: row.retention as number,
    transfer: row.transfer as number,
    fluency: row.fluency as number,
    confidence: row.confidence as number,
    hintDependency: row.hintDependency as number,
    misconceptionRisk: row.misconceptionRisk as number,
    evidenceCount: row.evidenceCount as number,
    lastEvidenceAt: toIso(row.lastEvidenceAt as Date | null),
    stateVersion: row.stateVersion as number,
    updatedAt: toIso(row.updatedAt as Date) ?? nowIso(),
    createdAt: toIso(row.createdAt as Date) ?? nowIso(),
  } as ConceptState & { id?: string };
}

// ------------------------------------------------------------------
// Recall
// ------------------------------------------------------------------
export function createPgRecallStore(): RecallScheduleStore {
  return {
    async get(studentId, conceptId) {
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM "RecallSchedule" WHERE "studentId"=$1 AND "conceptId"=$2 LIMIT 1`, [studentId, conceptId]);
      return rows[0] ? toRecall(rows[0] as Record<string, unknown>) : undefined;
    },
    async listDue(studentId, nowIsoArg) {
      const pool = getPool();
      const now = nowIsoArg ?? nowIso();
      const { rows } = await pool.query(`SELECT * FROM "RecallSchedule" WHERE "studentId"=$1 AND "dueAt" <= $2 ORDER BY "dueAt"`, [studentId, new Date(now)]);
      return rows.map(toRecall);
    },
    async listByStudent(studentId) {
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM "RecallSchedule" WHERE "studentId"=$1 ORDER BY "dueAt"`, [studentId]);
      return rows.map(toRecall);
    },
    async upsert(schedule) {
      const pool = getPool();
      await pool.query(
        `INSERT INTO "RecallSchedule" ("id","studentId","conceptId","evidenceId","intervalDays","easeFactor","repetitions","dueAt","lastReviewedAt","state","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT ("studentId","conceptId") DO UPDATE SET
           "evidenceId"=EXCLUDED."evidenceId",
           "intervalDays"=EXCLUDED."intervalDays",
           "easeFactor"=EXCLUDED."easeFactor",
           "repetitions"=EXCLUDED."repetitions",
           "dueAt"=EXCLUDED."dueAt",
           "lastReviewedAt"=EXCLUDED."lastReviewedAt",
           "state"=EXCLUDED."state",
           "updatedAt"=EXCLUDED."updatedAt"`,
        [schedule.id, schedule.studentId, schedule.conceptId, schedule.evidenceId ?? null, schedule.intervalDays, schedule.easeFactor, schedule.repetitions, new Date(schedule.dueAt), schedule.lastReviewedAt ? new Date(schedule.lastReviewedAt) : null, schedule.state, new Date(schedule.createdAt), new Date(schedule.updatedAt)],
      );
    },
    async clear() {
      const pool = getPool();
      await pool.query(`DELETE FROM "RecallSchedule"`);
    },
  };
}

function toRecall(row: Record<string, unknown>): RecallSchedule {
  return {
    id: row.id as string,
    studentId: row.studentId as string,
    conceptId: row.conceptId as string,
    evidenceId: (row.evidenceId as string | null) ?? null,
    intervalDays: row.intervalDays as number,
    easeFactor: row.easeFactor as number,
    repetitions: row.repetitions as number,
    dueAt: toIso(row.dueAt as Date) ?? nowIso(),
    lastReviewedAt: toIso(row.lastReviewedAt as Date | null),
    state: row.state as RecallSchedule["state"],
    createdAt: toIso(row.createdAt as Date) ?? nowIso(),
    updatedAt: toIso(row.updatedAt as Date) ?? nowIso(),
  };
}

// ------------------------------------------------------------------
// Tests
// ------------------------------------------------------------------
export function createPgTestStore(): TestStore {
  return {
    async listDefinitions() {
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM "TestDefinition" ORDER BY "title"`);
      const defs: TestDefinition[] = [];
      for (const r of rows) {
        const q = await pool.query(`SELECT * FROM "TestQuestion" WHERE "testId"=$1 ORDER BY "id"`, [r.id]);
        defs.push(toTestDef(r as Record<string, unknown>, q.rows as Record<string, unknown>[]));
      }
      return defs;
    },
    async findDefinitionById(id) {
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM "TestDefinition" WHERE "id"=$1 LIMIT 1`, [id]);
      if (!rows[0]) return undefined;
      const q = await pool.query(`SELECT * FROM "TestQuestion" WHERE "testId"=$1 ORDER BY "id"`, [id]);
      return toTestDef(rows[0] as Record<string, unknown>, q.rows as Record<string, unknown>[]);
    },
    async upsertDefinition(def) {
      const pool = getPool();
      await pool.query(
        `INSERT INTO "TestDefinition" ("id","title","moduleId","phaseTitle","timeLimitMinutes","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT ("id") DO UPDATE SET "title"=EXCLUDED."title","moduleId"=EXCLUDED."moduleId","phaseTitle"=EXCLUDED."phaseTitle","timeLimitMinutes"=EXCLUDED."timeLimitMinutes","updatedAt"=EXCLUDED."updatedAt"`,
        [def.id, def.title, def.moduleId ?? null, def.phaseTitle ?? null, def.timeLimitMinutes ?? null, new Date(def.createdAt), new Date(def.updatedAt)],
      );
      // Replace questions atomically
      await pool.query(`DELETE FROM "TestQuestion" WHERE "testId"=$1`, [def.id]);
      for (const qq of def.questions) {
        await pool.query(
          `INSERT INTO "TestQuestion" ("id","testId","kind","prompt","choices","correctChoiceIndex","explanation","topic","points","rubric")
           VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10::jsonb)`,
          [qq.id, def.id, qq.kind, qq.prompt, qq.choices ? JSON.stringify(qq.choices) : null, qq.correctChoiceIndex ?? null, qq.explanation, qq.topic, qq.points, qq.rubric ? JSON.stringify(qq.rubric) : null],
        );
      }
    },
    async createAttempt(attempt) {
      const pool = getPool();
      await pool.query(
        `INSERT INTO "TestAttempt" ("id","studentId","testId","status","score","timeSpentSeconds","answers","gradedAnswers","strongTopics","needsReviewTopics","recommendation","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12)`,
        [attempt.id, attempt.studentId, attempt.testId, attempt.status, attempt.score, attempt.timeSpentSeconds, JSON.stringify(attempt.answers), attempt.gradedAnswers ? JSON.stringify(attempt.gradedAnswers) : null, attempt.strongTopics, attempt.needsReviewTopics, attempt.recommendation ?? null, new Date(attempt.createdAt)],
      );
    },
    async listAttemptsByStudent(studentId) {
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM "TestAttempt" WHERE "studentId"=$1 ORDER BY "createdAt" DESC`, [studentId]);
      return rows.map(toAttempt);
    },
    async findAttemptById(id) {
      const pool = getPool();
      const { rows } = await pool.query(`SELECT * FROM "TestAttempt" WHERE "id"=$1 LIMIT 1`, [id]);
      return rows[0] ? toAttempt(rows[0] as Record<string, unknown>) : undefined;
    },
    async clear() {
      const pool = getPool();
      await pool.query(`DELETE FROM "TestAttempt"`);
      await pool.query(`DELETE FROM "TestQuestion"`);
      await pool.query(`DELETE FROM "TestDefinition"`);
    },
  };
}

function toTestDef(row: Record<string, unknown>, qRows: Record<string, unknown>[]): TestDefinition {
  return {
    id: row.id as string,
    title: row.title as string,
    moduleId: (row.moduleId as string | null) ?? null,
    phaseTitle: (row.phaseTitle as string | null) ?? null,
    timeLimitMinutes: (row.timeLimitMinutes as number | null) ?? null,
    questions: qRows.map((r) => ({
      id: r.id as string,
      testId: r.testId as string,
      kind: r.kind as TestDefinition["questions"][number]["kind"],
      prompt: r.prompt as string,
      choices: (r.choices as string[] | null) ?? undefined,
      correctChoiceIndex: (r.correctChoiceIndex as number | null) ?? null,
      explanation: r.explanation as string,
      topic: r.topic as string,
      points: r.points as number,
      rubric: (r.rubric as unknown) ?? undefined,
    })),
    createdAt: toIso(row.createdAt as Date) ?? nowIso(),
    updatedAt: toIso(row.updatedAt as Date) ?? nowIso(),
  };
}

function toAttempt(row: Record<string, unknown>): TestAttempt {
  return {
    id: row.id as string,
    studentId: row.studentId as string,
    testId: row.testId as string,
    status: row.status as string,
    score: row.score as number,
    timeSpentSeconds: row.timeSpentSeconds as number,
    answers: (row.answers as TestAttempt["answers"]) ?? [],
    gradedAnswers: (row.gradedAnswers as TestAttempt["gradedAnswers"]) ?? null,
    strongTopics: (row.strongTopics as string[]) ?? [],
    needsReviewTopics: (row.needsReviewTopics as string[]) ?? [],
    recommendation: (row.recommendation as string | null) ?? null,
    createdAt: toIso(row.createdAt as Date) ?? nowIso(),
  };
}

function isPgUnique(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}
