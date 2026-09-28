/**
 * Persistence ports — the ONLY way a domain engine touches storage.
 *
 * A domain engine receives one of these; it never imports Prisma, HTTP,
 * `window`, `localStorage` or any other infrastructure concern. Two
 * adapters satisfy each port today (`infrastructure/`): an in-memory
 * store for the server/tests and a localStorage store for the browser
 * mock runtime. Phase 2 adds Prisma adapters behind the SAME interfaces.
 *
 * Signatures are synchronous in Phase 1 because both current adapters
 * are synchronous. They become `async` in Phase 2 when Prisma lands —
 * the call sites are already isolated to the engines, so the change is
 * mechanical and does not touch domain rules.
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
  listByStudent(studentId: string): StoredAssessmentSession[];
  findById(id: string): StoredAssessmentSession | undefined;
  /** Insert or replace by id. */
  upsert(session: StoredAssessmentSession): void;
  /** Test seam. Prisma implements this as `deleteMany()`. */
  clear(): void;
}

/* ------------------------------------------------------------------ */
/* Goal                                                                */
/* ------------------------------------------------------------------ */

export interface GoalStore {
  listByStudent(studentId: string): LearningGoal[];
  findById(id: string): LearningGoal | undefined;
  upsert(goal: LearningGoal): void;
  /** Test seam. Prisma implements this as `deleteMany()`. */
  clear(): void;
}

/* ------------------------------------------------------------------ */
/* Roadmap                                                             */
/* ------------------------------------------------------------------ */

export interface RoadmapStore {
  listByStudent(studentId: string): Roadmap[];
  findById(id: string): Roadmap | undefined;
  upsert(roadmap: Roadmap): void;
  /** Test seam. Prisma implements this as `deleteMany()`. */
  clear(): void;
}

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */

export interface ExecutionStore {
  listByRoadmap(roadmapId: string): LearningUnitExecution[];
  /** All records — the engine needs cross-roadmap reads for retries. */
  list(): LearningUnitExecution[];
  upsert(execution: LearningUnitExecution): void;
  /** Test seam. Prisma implements this as `deleteMany()`. */
  clear(): void;
}
