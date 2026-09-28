/**
 * Persistence ports — the ONLY way a domain engine touches storage.
 *
 * A domain engine receives one of these; it never imports Prisma, HTTP,
 * `window`, `localStorage` or any other infrastructure concern. Two
 * adapters satisfy each port today (`infrastructure/`): an in-memory
 * store for the server/tests and a localStorage store for the browser
 * mock runtime. Phase 2 adds Prisma adapters behind the SAME interfaces.
 *
 * Every method is `async`. Real persistence (Prisma/PostgreSQL) is
 * asynchronous, so the ports are too; the in-memory and localStorage
 * adapters simply resolve immediately. Keeping the ports async from the
 * start means swapping adapters never changes an engine signature.
 *
 * Deliberately minimal: one store per aggregate root, shaped the way a
 * database row is fetched and written. No `GenericRepository<T>`, no
 * base class, no query builder.
 */

import type { BankItem } from "@/services/assessment/question-bank";
import type {
  AssessmentDifficulty,
  AssessmentQuestion,
  AssessmentResponse,
  AssessmentStatus,
  AssessmentTopicId,
  StudentAssessmentProfile,
} from "@/types/assessment";
import type { LearningUnitExecution } from "@/types/execution";
import type { LearningGoal } from "@/types/goal";
import type { Roadmap } from "@/types/roadmap";

/**
 * A write the domain considered valid but the database refused (§28).
 *
 * This exists so no caller ever has to recognise a database error. A unique
 * constraint firing means a concurrent writer won the race for an idempotency
 * key — the honest answer is "conflict, retry", not a silent success and not
 * a stack trace carrying a constraint name into an HTTP response.
 */
export class PersistenceConflictError extends Error {
  constructor(
    readonly reason: "duplicate_key" | "invalid_reference" | "not_found",
    message?: string,
  ) {
    super(message ?? reason);
    this.name = "PersistenceConflictError";
  }
}

/* ------------------------------------------------------------------ */
/* Assessment                                                          */
/* ------------------------------------------------------------------ */

/** One graded response, stored server-side with its score. */
export interface StoredAssessmentResponse {
  submissionId: string;
  response: AssessmentResponse;
  /** 1 = correct, 0.5 = partial credit, 0 = incorrect. */
  points: number;
  difficulty: AssessmentDifficulty;
  questionType: AssessmentQuestion["type"];
  at: string;
}

export interface StoredTopicState {
  asked: number;
  points: number;
  lastDifficulty: AssessmentDifficulty | null;
  lastPoints: number | null;
}

/**
 * The assessment aggregate as persisted.
 *
 * `bank` and `topics` are INTERNAL: they carry the answer key and must
 * never be serialised to a client. `studentId` is the ownership anchor —
 * every read and write is scoped by it.
 */
export interface StoredAssessmentSession {
  id: string;
  /** Owner. Always resolved from the authenticated session, never input. */
  studentId: string;
  status: Exclude<AssessmentStatus, "not_started">;
  startedAt: string;
  completedAt?: string;
  responses: StoredAssessmentResponse[];
  topics: Record<string, StoredTopicState>;
  lastTopic: AssessmentTopicId | null;
  profile?: StudentAssessmentProfile;
  /** Engine-only question bank, including scoring. Never leaves the server. */
  bank?: BankItem[];
  /** Engine-only topic list for this session. */
  sessionTopics?: AssessmentTopicId[];
}

export interface AssessmentSessionStore {
  /** Every session owned by one student. */
  listByStudent(studentId: string): Promise<StoredAssessmentSession[]>;
  findById(id: string): Promise<StoredAssessmentSession | undefined>;
  /** Insert or replace by id. */
  upsert(session: StoredAssessmentSession): Promise<void>;
  /** Test seam. Prisma implements this as `deleteMany()`. */
  clear(): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Goal                                                                */
/* ------------------------------------------------------------------ */

/**
 * Runs `work` so that every write it makes is committed together or not at
 * all.
 *
 * Only the two stores that own a multi-aggregate write expose this: revising
 * a goal marks the old one `revised` AND inserts its successor, and
 * regenerating a roadmap supersedes the previous plan AND inserts the new
 * one. Both are two aggregates that must agree, so both need a transaction.
 * Every other store writes exactly one row per call and does not get one —
 * a transaction that guards a single write is theatre, not safety.
 *
 * The in-memory and localStorage adapters run `work` directly: they have no
 * partial write to protect.
 */
export type TransactionRunner = <T>(work: () => Promise<T>) => Promise<T>;

export interface GoalStore {
  listByStudent(studentId: string): Promise<LearningGoal[]>;
  findById(id: string): Promise<LearningGoal | undefined>;
  upsert(goal: LearningGoal): Promise<void>;
  /** Atomic multi-write. See `TransactionRunner`. */
  transaction: TransactionRunner;
  /** Test seam. Prisma implements this as `deleteMany()`. */
  clear(): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Roadmap                                                             */
/* ------------------------------------------------------------------ */

export interface RoadmapStore {
  listByStudent(studentId: string): Promise<Roadmap[]>;
  findById(id: string): Promise<Roadmap | undefined>;
  upsert(roadmap: Roadmap): Promise<void>;
  /** Atomic multi-write: supersede + insert. See `TransactionRunner`. */
  transaction: TransactionRunner;
  /** Test seam. Prisma implements this as `deleteMany()`. */
  clear(): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */

export interface ExecutionStore {
  listByRoadmap(roadmapId: string): Promise<LearningUnitExecution[]>;
  /** All records — the engine needs cross-roadmap reads for retries. */
  list(): Promise<LearningUnitExecution[]>;
  upsert(execution: LearningUnitExecution): Promise<void>;
  /** Test seam. Prisma implements this as `deleteMany()`. */
  clear(): Promise<void>;
}
