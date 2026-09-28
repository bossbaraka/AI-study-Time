/**
 * Prisma adapter for `RoadmapStore` (§5).
 *
 * A roadmap is an aggregate: one `Roadmap` row, its milestones, and each
 * milestone's learning units. Writing it is therefore one transaction — a
 * roadmap saved without its milestones would be a plan with no steps.
 *
 * **Milestones and units are upserted, never deleted-and-recreated.** A
 * roadmap is re-saved on every status change (pause, resume, supersede), and
 * `LearningUnitExecution` cascades from its learning unit. Deleting the units
 * to rewrite them would silently delete the student's execution history with
 * them. The generated content of a roadmap is immutable — regenerating after a
 * goal revision produces a *new* roadmap row with a new id — so upsert writes
 * the same values it would have written the first time.
 */
import type { PrismaClient, Prisma } from "@prisma/client";

import type { RoadmapStore, TransactionRunner } from "@/services/ports/stores";
import type { LearningUnit, Milestone, Roadmap } from "@/types/roadmap";

import { currentClient, inTransaction, translateDbError } from "./context";

type Json = Prisma.InputJsonValue;

function json(value: unknown): Json {
  return (value ?? null) as Json;
}

/**
 * Deterministic surrogate keys. The domain ids (`ms_<capabilityId>`,
 * `unit_<capabilityId>_<slotType>`) are derived from the curriculum and so
 * REPEAT across roadmap versions; scoping them to the roadmap makes the
 * surrogate id both unique and stable, which is what lets an upsert be a
 * no-op on the second write.
 */
const milestoneRowId = (roadmapId: string, milestoneId: string) => `${roadmapId}::${milestoneId}`;
const unitRowId = (roadmapId: string, unitId: string) => `${roadmapId}::${unitId}`;

type RoadmapRow = {
  id: string;
  studentId: string;
  goalId: string;
  version: number;
  status: string;
  title: string;
  description: string;
  estimatedDuration: Prisma.JsonValue;
  weeklyCommitment: number;
  totalEstimatedHours: number;
  timeFeasibility: Prisma.JsonValue;
  generationContext: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  milestones: {
    milestoneId: string;
    capabilityId: string;
    title: string;
    description: string;
    order: number;
    status: string;
    learningOutcome: string;
    estimatedHours: number;
    goalAlignment: string;
    maintenance: boolean;
    dependencies: string[];
    checkpoint: Prisma.JsonValue;
    learningUnits: {
      unitId: string;
      type: string;
      order: number;
      title: string;
      purpose: string;
      estimatedMinutes: number;
      expectedOutcome: string;
      completionEvidence: string;
    }[];
  }[];
};

const includeAll = {
  milestones: {
    orderBy: { order: "asc" },
    include: { learningUnits: { orderBy: { order: "asc" } } },
  },
} satisfies Prisma.RoadmapInclude;

function toDomain(row: RoadmapRow): Roadmap {
  const milestones: Milestone[] = row.milestones.map((m) => ({
    id: m.milestoneId,
    roadmapId: row.id,
    capabilityId: m.capabilityId,
    title: m.title,
    description: m.description,
    order: m.order,
    status: m.status as Milestone["status"],
    learningOutcome: m.learningOutcome,
    estimatedHours: m.estimatedHours,
    dependencies: [...m.dependencies],
    checkpoint: m.checkpoint as unknown as Milestone["checkpoint"],
    goalAlignment: m.goalAlignment,
    maintenance: m.maintenance,
    learningUnits: m.learningUnits.map(
      (u): LearningUnit => ({
        id: u.unitId,
        milestoneId: m.milestoneId,
        type: u.type as LearningUnit["type"],
        order: u.order,
        title: u.title,
        purpose: u.purpose,
        estimatedMinutes: u.estimatedMinutes,
        expectedOutcome: u.expectedOutcome,
        completionEvidence: u.completionEvidence,
      }),
    ),
  }));

  return {
    id: row.id,
    studentId: row.studentId,
    goalId: row.goalId,
    version: row.version,
    status: row.status as Roadmap["status"],
    title: row.title,
    description: row.description,
    estimatedDuration: row.estimatedDuration as unknown as Roadmap["estimatedDuration"],
    weeklyCommitment: row.weeklyCommitment,
    totalEstimatedHours: row.totalEstimatedHours,
    timeFeasibility: row.timeFeasibility as unknown as Roadmap["timeFeasibility"],
    milestones,
    generationContext: row.generationContext as unknown as Roadmap["generationContext"],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class PrismaRoadmapStore implements RoadmapStore {
  constructor(private readonly prisma: PrismaClient) {}

  private get db() {
    return currentClient(this.prisma);
  }

  async listByStudent(studentId: string): Promise<Roadmap[]> {
    const rows = await this.db.roadmap.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      include: includeAll,
    });
    return rows.map(toDomain);
  }

  async findById(id: string): Promise<Roadmap | undefined> {
    const row = await this.db.roadmap.findUnique({ where: { id }, include: includeAll });
    return row ? toDomain(row) : undefined;
  }

  /**
   * Writes the roadmap and its whole step tree in one transaction (§13).
   *
   * A duplicate `generationKey` or `(studentId, version)` means a concurrent
   * generation for the same goal version won the race. That becomes a
   * `PersistenceConflictError` rather than a second roadmap — which is the
   * entire point of having moved those checks out of an in-memory scan and
   * into constraints (§14).
   */
  async upsert(roadmap: Roadmap): Promise<void> {
    try {
      await inTransaction(this.prisma, () => this.write(roadmap));
    } catch (error) {
      throw translateDbError(error);
    }
  }

  private async write(roadmap: Roadmap): Promise<void> {
    const db = this.db;
    const fields = {
      studentId: roadmap.studentId,
      goalId: roadmap.goalId,
      version: roadmap.version,
      status: roadmap.status,
      title: roadmap.title,
      description: roadmap.description,
      estimatedDuration: json(roadmap.estimatedDuration) as unknown as Json,
      weeklyCommitment: roadmap.weeklyCommitment,
      totalEstimatedHours: roadmap.totalEstimatedHours,
      timeFeasibility: json(roadmap.timeFeasibility) as unknown as Json,
      generationContext: json(roadmap.generationContext) as unknown as Json,
      // The idempotency anchor. It is promoted out of the JSON context into
      // its own column precisely so the database can enforce uniqueness on it.
      generationKey: roadmap.generationContext.generationKey,
      createdAt: new Date(roadmap.createdAt),
      updatedAt: new Date(roadmap.updatedAt),
    };

    await db.roadmap.upsert({
      where: { id: roadmap.id },
      create: { id: roadmap.id, ...fields },
      update: fields,
    });

    for (const milestone of roadmap.milestones) {
      const milestoneFields = {
        roadmapId: roadmap.id,
        milestoneId: milestone.id,
        capabilityId: milestone.capabilityId,
        title: milestone.title,
        description: milestone.description,
        order: milestone.order,
        status: milestone.status,
        learningOutcome: milestone.learningOutcome,
        estimatedHours: milestone.estimatedHours,
        goalAlignment: milestone.goalAlignment,
        maintenance: milestone.maintenance,
        dependencies: [...milestone.dependencies],
        checkpoint: json(milestone.checkpoint) as unknown as Json,
      };
      await db.roadmapMilestone.upsert({
        where: { id: milestoneRowId(roadmap.id, milestone.id) },
        create: { id: milestoneRowId(roadmap.id, milestone.id), ...milestoneFields },
        update: milestoneFields,
      });

      for (const unit of milestone.learningUnits) {
        const unitFields = {
          roadmapId: roadmap.id,
          milestoneId: milestoneRowId(roadmap.id, milestone.id),
          unitId: unit.id,
          type: unit.type,
          order: unit.order,
          title: unit.title,
          purpose: unit.purpose,
          estimatedMinutes: unit.estimatedMinutes,
          expectedOutcome: unit.expectedOutcome,
          completionEvidence: unit.completionEvidence,
        };
        await db.learningUnit.upsert({
          where: { id: unitRowId(roadmap.id, unit.id) },
          create: { id: unitRowId(roadmap.id, unit.id), ...unitFields },
          update: unitFields,
        });
      }
    }
  }

  transaction: TransactionRunner = (work) => inTransaction(this.prisma, work);

  async clear(): Promise<void> {
    // Executions reference learning units, so they go first; cascades then
    // carry the rest of the tree down with the roadmap.
    await this.db.learningUnitExecution.deleteMany();
    await this.db.learningUnit.deleteMany();
    await this.db.roadmapMilestone.deleteMany();
    await this.db.roadmap.deleteMany();
  }
}
