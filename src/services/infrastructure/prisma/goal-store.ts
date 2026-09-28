/**
 * Prisma adapter for `GoalStore` (§5).
 *
 * The domain object is `LearningGoal`; nothing above this file ever sees a
 * `Goal` row, a `Prisma.JsonValue` or a `Date`. Value objects that have no
 * identity of their own — motivation, target domain, timeframe, commitment,
 * diagnosis snapshot, validation result — are stored as JSON on the goal row
 * rather than given tables, because they are never queried, never joined and
 * never updated apart from their goal.
 *
 * Timestamps are written from the domain, not from the database. The engine
 * sets `createdAt`/`updatedAt`/`lockedAt` as part of the state transition it
 * is performing, and letting the database overwrite `updatedAt` would make
 * the persisted goal disagree with the one the engine just returned.
 */
import type { PrismaClient, Prisma } from "@prisma/client";

import type { GoalStore, TransactionRunner } from "@/services/ports/stores";
import type { LearningGoal } from "@/types/goal";

import { currentClient, inTransaction, translateDbError } from "./context";

type Json = Prisma.InputJsonValue;

function json(value: unknown): Json {
  return (value ?? null) as Json;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

type GoalRow = {
  id: string;
  studentId: string;
  status: string;
  desiredOutcome: string;
  motivation: Prisma.JsonValue;
  targetDomain: Prisma.JsonValue;
  currentLevel: string;
  targetLevel: string;
  timeframe: Prisma.JsonValue;
  weeklyCommitment: Prisma.JsonValue;
  constraints: string[];
  successCriteria: string[];
  diagnosisContext: Prisma.JsonValue;
  validation: Prisma.JsonValue;
  version: number;
  createIdempotencyKey: string | null;
  lockIdempotencyKey: string | null;
  revisesGoalId: string | null;
  createdAt: Date;
  updatedAt: Date;
  lockedAt: Date | null;
};

function toDomain(row: GoalRow): LearningGoal {
  return {
    id: row.id,
    studentId: row.studentId,
    status: row.status as LearningGoal["status"],
    desiredOutcome: row.desiredOutcome,
    motivation: row.motivation as unknown as LearningGoal["motivation"],
    targetDomain: row.targetDomain as unknown as LearningGoal["targetDomain"],
    currentLevel: row.currentLevel as LearningGoal["currentLevel"],
    targetLevel: row.targetLevel as LearningGoal["targetLevel"],
    timeframe: row.timeframe as unknown as LearningGoal["timeframe"],
    weeklyCommitment: row.weeklyCommitment as unknown as LearningGoal["weeklyCommitment"],
    constraints: [...row.constraints] as LearningGoal["constraints"],
    successCriteria: [...row.successCriteria],
    diagnosisContext: (row.diagnosisContext as unknown as LearningGoal["diagnosisContext"]) ?? null,
    validation: (row.validation as unknown as LearningGoal["validation"]) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lockedAt: toIso(row.lockedAt),
    version: row.version,
    createIdempotencyKey: row.createIdempotencyKey ?? undefined,
    lockIdempotencyKey: row.lockIdempotencyKey ?? undefined,
    revisesGoalId: row.revisesGoalId ?? undefined,
  };
}

export class PrismaGoalStore implements GoalStore {
  constructor(private readonly prisma: PrismaClient) {}

  private get db() {
    return currentClient(this.prisma);
  }

  async listByStudent(studentId: string): Promise<LearningGoal[]> {
    const rows = await this.db.goal.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<LearningGoal | undefined> {
    const row = await this.db.goal.findUnique({ where: { id } });
    return row ? toDomain(row) : undefined;
  }

  async upsert(goal: LearningGoal): Promise<void> {
    const fields = {
      studentId: goal.studentId,
      status: goal.status,
      desiredOutcome: goal.desiredOutcome,
      motivation: json(goal.motivation) as unknown as Json,
      targetDomain: json(goal.targetDomain) as unknown as Json,
      currentLevel: goal.currentLevel,
      targetLevel: goal.targetLevel,
      timeframe: json(goal.timeframe) as unknown as Json,
      weeklyCommitment: json(goal.weeklyCommitment) as unknown as Json,
      constraints: [...goal.constraints],
      successCriteria: [...goal.successCriteria],
      diagnosisContext: json(goal.diagnosisContext) as unknown as Json,
      validation: json(goal.validation) as unknown as Json,
      version: goal.version,
      createIdempotencyKey: goal.createIdempotencyKey ?? null,
      lockIdempotencyKey: goal.lockIdempotencyKey ?? null,
      revisesGoalId: goal.revisesGoalId ?? null,
      createdAt: new Date(goal.createdAt),
      updatedAt: new Date(goal.updatedAt),
      lockedAt: goal.lockedAt ? new Date(goal.lockedAt) : null,
    };
    try {
      await this.db.goal.upsert({
        where: { id: goal.id },
        create: { id: goal.id, ...fields },
        update: fields,
      });
    } catch (error) {
      // A duplicate `(studentId, createIdempotencyKey)` or
      // `(studentId, lockIdempotencyKey)` means a concurrent request already
      // committed this transition. Surfacing it as a conflict is the honest
      // answer: reporting success here would hand the caller a goal id that
      // was never written.
      throw translateDbError(error);
    }
  }

  transaction: TransactionRunner = (work) => inTransaction(this.prisma, work);

  async clear(): Promise<void> {
    // Goals cascade to their roadmaps, which cascade to milestones, units and
    // executions, so one delete is enough — but the self-relation has to go
    // first or a goal still referencing a deleted parent blocks the delete.
    await this.db.goal.updateMany({ data: { revisesGoalId: null } });
    await this.db.goal.deleteMany();
  }
}
