/**
 * Prisma adapter for `ExecutionStore` (§5).
 *
 * One row per (roadmap, learning unit): a retry mutates the existing attempt
 * rather than appending a new one, which is exactly what the unique
 * constraint on `(roadmapId, learningUnitId)` encodes. The engine still
 * performs that lookup itself; the constraint is what makes the answer
 * correct when two submissions arrive at once instead of merely when they
 * arrive in turn.
 *
 * `list()` exists because the engine reads across roadmaps when deciding
 * whether a unit has been attempted before. That is a real query pattern, not
 * an escape hatch — but it is unbounded, and is called out as such in the
 * Phase 2 report.
 */
import type { PrismaClient, Prisma } from "@prisma/client";

import type { ExecutionStore } from "@/services/ports/stores";
import type { LearningUnitExecution } from "@/types/execution";

import { currentClient, translateDbError } from "./context";

type Json = Prisma.InputJsonValue;

function json(value: unknown): Json {
  return (value ?? null) as Json;
}

function toIso(value: Date | null): string | undefined {
  return value ? value.toISOString() : undefined;
}

type ExecutionRow = {
  id: string;
  studentId: string;
  roadmapId: string;
  milestoneId: string;
  learningUnitId: string;
  status: string;
  startedAt: Date | null;
  submittedAt: Date | null;
  evaluatedAt: Date | null;
  evidence: Prisma.JsonValue;
  result: Prisma.JsonValue;
};

function toDomain(row: ExecutionRow): LearningUnitExecution {
  return {
    id: row.id,
    studentId: row.studentId,
    roadmapId: row.roadmapId,
    milestoneId: row.milestoneId,
    learningUnitId: row.learningUnitId,
    status: row.status as LearningUnitExecution["status"],
    startedAt: toIso(row.startedAt),
    submittedAt: toIso(row.submittedAt),
    evaluatedAt: toIso(row.evaluatedAt),
    evidence: (row.evidence as unknown as LearningUnitExecution["evidence"]) ?? undefined,
    result: (row.result as unknown as LearningUnitExecution["result"]) ?? undefined,
  };
}

export class PrismaExecutionStore implements ExecutionStore {
  constructor(private readonly prisma: PrismaClient) {}

  private get db() {
    return currentClient(this.prisma);
  }

  async listByRoadmap(roadmapId: string): Promise<LearningUnitExecution[]> {
    const rows = await this.db.learningUnitExecution.findMany({
      where: { roadmapId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toDomain);
  }

  async list(): Promise<LearningUnitExecution[]> {
    const rows = await this.db.learningUnitExecution.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map(toDomain);
  }

  async upsert(execution: LearningUnitExecution): Promise<void> {
    const fields = {
      studentId: execution.studentId,
      roadmapId: execution.roadmapId,
      milestoneId: execution.milestoneId,
      learningUnitId: execution.learningUnitId,
      status: execution.status,
      startedAt: execution.startedAt ? new Date(execution.startedAt) : null,
      submittedAt: execution.submittedAt ? new Date(execution.submittedAt) : null,
      evaluatedAt: execution.evaluatedAt ? new Date(execution.evaluatedAt) : null,
      evidence: json(execution.evidence ?? null) as unknown as Json,
      result: json(execution.result ?? null) as unknown as Json,
    };
    try {
      await this.db.learningUnitExecution.upsert({
        where: { id: execution.id },
        create: { id: execution.id, ...fields },
        update: fields,
      });
    } catch (error) {
      throw translateDbError(error);
    }
  }

  async clear(): Promise<void> {
    await this.db.learningUnitExecution.deleteMany();
  }
}
