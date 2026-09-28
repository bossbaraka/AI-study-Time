/**
 * Persistence reality — the guarantees ONLY a real database can make (§18).
 *
 * The shared contract in `store-contract.test.ts` proves both adapters behave
 * alike. This file proves the PostgreSQL adapter does the things a mock
 * fundamentally cannot: enforce a unique constraint under concurrency, reject
 * an impossible foreign key, roll a transaction back, cascade on delete, and
 * keep the answer key in a column that no public read ever touches.
 *
 * These are the invariants the Phase 1 in-memory implementation could only
 * approximate with `if (!existing) create` — a check that is correct when
 * requests arrive in turn and wrong when they arrive together.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/server/db";
import { createPrismaStores } from "@/services/infrastructure/prisma";
import { PersistenceConflictError } from "@/services/ports/stores";
import { mockGoalEngine, mockRoadmapEngine } from "@/services/engines";
import type { StoredAssessmentSession } from "@/services/ports/stores";
import type { LearningGoal } from "@/types/goal";

const STUDENT = "student_reality_a";
const OTHER = "student_reality_b";

const stores = createPrismaStores(prisma);

async function seedUsers() {
  for (const id of [STUDENT, OTHER]) {
    await prisma.user.upsert({
      where: { id },
      create: {
        id,
        email: `${id}@reality.test`,
        passwordHash: "x",
        name: id,
        role: "student",
        status: "active",
      },
      update: {},
    });
  }
}

async function realGoal(studentId: string, key: string): Promise<LearningGoal> {
  const { goal } = await mockGoalEngine.createGoal(
    {
      targetDomain: { kind: "preset", presetId: "backend" },
      desiredOutcome:
        "Build and deploy two practical backend apps with a database and authentication",
      motivation: { kind: "career" },
      currentLevel: "developing",
      targetLevel: "build_independently",
      timeframe: { weeks: 12, preset: true },
      weeklyCommitment: { hoursPerWeek: 7, preset: true },
      constraints: [],
      successCriteria: ["Ship an app with real authentication end to end"],
    },
    { studentId, idempotencyKey: key, diagnosisContext: null },
  );
  return goal;
}

async function seededRoadmap(key: string) {
  const goal = await realGoal(STUDENT, key);
  await stores.goals.upsert(goal);
  await mockGoalEngine.lockGoal(goal.id, STUDENT, `lock-${goal.id}`);
  await stores.goals.upsert((await mockGoalEngine.getGoal(goal.id, STUDENT)) as LearningGoal);
  const { roadmap } = await mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
  return roadmap;
}

function sessionWithAnswer(id: string, submissionId: string): StoredAssessmentSession {
  return {
    id,
    studentId: STUDENT,
    status: "in_progress",
    startedAt: "2026-09-01T08:00:00.000Z",
    responses: [
      {
        submissionId,
        response: { type: "multiple_choice", questionId: "fn_f1", optionId: "o1" },
        points: 1,
        difficulty: "foundational",
        questionType: "multiple_choice",
        at: "2026-09-01T08:01:00.000Z",
      },
    ],
    topics: { functions: { asked: 1, points: 1, lastDifficulty: "foundational", lastPoints: 1 } },
    lastTopic: "functions",
    sessionTopics: ["functions"],
    bank: [
      {
        question: {
          id: "fn_f1",
          type: "multiple_choice",
          prompt: "What does a function return when it has no return statement?",
          options: [
            { id: "o1", label: "undefined" },
            { id: "o2", label: "null" },
          ],
          topic: "functions",
          difficulty: "foundational",
          estimatedSeconds: 45,
        },
        scoring: { kind: "option", correctOptionId: "o1" },
      },
    ],
  };
}

describe("Prisma store — persistence reality", () => {
  beforeEach(async () => {
    await stores.resetAll();
    await seedUsers();
    await mockGoalEngine.__reset();
    await mockRoadmapEngine.__reset();
  });

  it("rejects a duplicate creation idempotency key rather than creating a second goal (§14)", async () => {
    const first = await realGoal(STUDENT, "race-key");
    await stores.goals.upsert(first);

    // A different goal id carrying the SAME idempotency key: exactly what two
    // concurrent requests produce when both pass the engine's pre-check.
    const impostor = { ...first, id: "goal_impostor", desiredOutcome: "Something else" };
    await expect(stores.goals.upsert(impostor)).rejects.toBeInstanceOf(PersistenceConflictError);

    const rows = await prisma.goal.findMany({ where: { studentId: STUDENT } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(first.id);
  });

  it("lets two students reuse the same idempotency key — ownership is part of the key", async () => {
    const mine = await realGoal(STUDENT, "shared-key");
    const theirs = await realGoal(OTHER, "shared-key");
    await stores.goals.upsert(mine);
    await expect(stores.goals.upsert(theirs)).resolves.toBeUndefined();

    expect(await prisma.goal.count({ where: { createIdempotencyKey: "shared-key" } })).toBe(2);
  });

  it("rejects a duplicate roadmap generation key (§14)", async () => {
    const roadmap = await seededRoadmap("gen-key");
    await stores.roadmaps.upsert(roadmap);

    const impostor = { ...roadmap, id: "roadmap_impostor" };
    await expect(stores.roadmaps.upsert(impostor)).rejects.toBeInstanceOf(PersistenceConflictError);
    expect(await prisma.roadmap.count({ where: { studentId: STUDENT } })).toBe(1);
  });

  it("counts a replayed submission exactly once when two writers race (§14/§15)", async () => {
    // Two concurrent submissions of the SAME answer. Both engines read the
    // session before either writes, so both try to insert the same
    // (sessionId, submissionId). The unique constraint is what makes the
    // loser lose loudly instead of the answer being counted twice.
    const first = sessionWithAnswer("asess_replay", "sub_replay");
    const second = { ...first };

    const outcomes = await Promise.allSettled([
      stores.assessmentSessions.upsert(first),
      stores.assessmentSessions.upsert(second),
    ]);

    const rows = await prisma.assessmentAnswer.findMany({
      where: { sessionId: "asess_replay" },
    });
    expect(rows).toHaveLength(1);
    // Whichever writer lost was told about it, not silently succeeded.
    const rejected = outcomes.filter((o) => o.status === "rejected");
    for (const outcome of rejected) {
      expect((outcome as PromiseRejectedResult).reason).toBeInstanceOf(PersistenceConflictError);
    }
  });

  it("refuses an execution that points at a unit outside its own roadmap (§9)", async () => {
    const roadmap = await seededRoadmap("fk-scope");
    await stores.roadmaps.upsert(roadmap);
    const milestone = roadmap.milestones[0];
    const unit = milestone?.learningUnits[0];
    if (!milestone || !unit) throw new Error("fixture produced an empty roadmap");

    await expect(
      stores.executions.upsert({
        id: "exec_bad_fk",
        studentId: STUDENT,
        roadmapId: roadmap.id,
        milestoneId: milestone.id,
        // A well-formed but foreign unit id: the composite key catches it.
        learningUnitId: "unit_from_some_other_roadmap",
        status: "in_progress",
      }),
    ).rejects.toBeInstanceOf(PersistenceConflictError);
  });

  it("allows only one execution per unit per roadmap — a retry mutates, never appends (§9)", async () => {
    const roadmap = await seededRoadmap("one-per-unit");
    await stores.roadmaps.upsert(roadmap);
    const milestone = roadmap.milestones[0];
    const unit = milestone?.learningUnits[0];
    if (!milestone || !unit) throw new Error("fixture produced an empty roadmap");

    await stores.executions.upsert({
      id: "exec_first",
      studentId: STUDENT,
      roadmapId: roadmap.id,
      milestoneId: milestone.id,
      learningUnitId: unit.id,
      status: "in_progress",
    });

    await expect(
      stores.executions.upsert({
        id: "exec_second_attempt",
        studentId: STUDENT,
        roadmapId: roadmap.id,
        milestoneId: milestone.id,
        learningUnitId: unit.id,
        status: "in_progress",
      }),
    ).rejects.toBeInstanceOf(PersistenceConflictError);
  });

  it("rolls a transaction back completely when its work throws (§13)", async () => {
    const first = await realGoal(STUDENT, "tx-rollback-1");
    const second = await realGoal(STUDENT, "tx-rollback-2");

    await expect(
      stores.goals.transaction(async () => {
        await stores.goals.upsert(first);
        await stores.goals.upsert(second);
        throw new Error("something downstream failed");
      }),
    ).rejects.toThrow("something downstream failed");

    // Neither write survived. A mock adapter cannot make this promise; that
    // is precisely why goal revision needs a real transaction.
    expect(await prisma.goal.count({ where: { studentId: STUDENT } })).toBe(0);
  });

  it("commits every write of a multi-aggregate transaction together (§13)", async () => {
    const original = await realGoal(STUDENT, "tx-commit-old");
    await stores.goals.upsert(original);

    // Shaped the way `reviseGoal` actually shapes it: a fresh id, and BOTH
    // idempotency keys cleared — a revision is a new creation, not a replay.
    const successor = {
      ...original,
      id: "goal_successor",
      status: "discovered" as const,
      createIdempotencyKey: undefined,
      lockIdempotencyKey: undefined,
      revisesGoalId: original.id,
    };
    await stores.goals.transaction(async () => {
      await stores.goals.upsert(successor);
      await stores.goals.upsert({ ...original, status: "revised" as const, revisesGoalId: successor.id });
    });

    const rows = await prisma.goal.findMany({ where: { studentId: STUDENT } });
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === original.id)?.status).toBe("revised");
    expect(rows.find((r) => r.id === successor.id)?.revisesGoalId).toBe(original.id);
  });

  it("cascades: deleting a student removes their learning data and leaves no orphans (§9)", async () => {
    const roadmap = await seededRoadmap("cascade");
    await stores.roadmaps.upsert(roadmap);
    await stores.assessmentSessions.upsert(sessionWithAnswer("asess_cascade", "sub_cascade"));

    await prisma.user.delete({ where: { id: STUDENT } });

    expect(await prisma.goal.count({ where: { studentId: STUDENT } })).toBe(0);
    expect(await prisma.roadmap.count({ where: { studentId: STUDENT } })).toBe(0);
    expect(await prisma.roadmapMilestone.count({ where: { roadmapId: roadmap.id } })).toBe(0);
    expect(await prisma.learningUnit.count({ where: { roadmapId: roadmap.id } })).toBe(0);
    expect(await prisma.assessmentSession.count({ where: { studentId: STUDENT } })).toBe(0);
  });

  /**
   * §20: the answer key must be unreachable from the public representation.
   *
   * The schema makes this structural — `AssessmentQuestion.question` holds
   * what a student may see and `scoring` holds the key, in separate columns.
   * This test is the proof: it serialises exactly what a serializer built
   * from the public column would emit, and asserts the key is absent while
   * the readable question is present.
   */
  it("keeps the answer key out of the public question payload (§20)", async () => {
    await stores.assessmentSessions.upsert(sessionWithAnswer("asess_keyboundary", "sub_key"));

    const rows = await prisma.assessmentQuestion.findMany({
      where: { sessionId: "asess_keyboundary" },
    });
    expect(rows).toHaveLength(1);

    const wire = JSON.stringify(rows[0]?.question);
    expect(wire).toContain("What does a function return");
    expect(wire).toContain("undefined"); // the option text is served
    expect(wire).not.toContain("correctOptionId");
    expect(wire).not.toContain("scoring");
    // The option ids themselves are public — the student has to be able to
    // pick one. What must not cross is WHICH of them the bank marks correct.
    expect(wire).toContain("o1");

    // And the key IS stored — just somewhere no public read touches.
    expect(JSON.stringify(rows[0]?.scoring)).toContain("correctOptionId");
  });

  it("survives two concurrent writers racing on one idempotency key (§15)", async () => {
    const a = await realGoal(STUDENT, "concurrent-key");
    const b = { ...a, id: "goal_concurrent_b" };

    const outcomes = await Promise.allSettled([stores.goals.upsert(a), stores.goals.upsert(b)]);
    const rejected = outcomes.filter((o) => o.status === "rejected");
    const fulfilled = outcomes.filter((o) => o.status === "fulfilled");

    // Exactly one writer wins; the loser is told so rather than being lied to.
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(PersistenceConflictError);
    expect(await prisma.goal.count({ where: { studentId: STUDENT } })).toBe(1);
  });
});
