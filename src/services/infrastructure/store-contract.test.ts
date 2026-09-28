/**
 * One behavioural contract, asserted against BOTH persistence adapters (§18).
 *
 * The rule this file enforces: a store is not correct because it compiles
 * against the port, it is correct because it behaves identically to every
 * other store. So the same assertions run against the in-memory collections
 * and against real PostgreSQL, and any difference between them is a defect in
 * one of the two.
 *
 * What is deliberately NOT here: the guarantees only a database can make —
 * unique constraints, foreign keys, rollback, cascades. Those live in
 * `prisma-store-reality.test.ts`. Mocks test the contract; the database tests
 * persistence reality. Both are required, and neither substitutes for the
 * other.
 */
import { beforeEach, describe, expect, it } from "vitest";

import { createStores } from "@/services/infrastructure";
import { createPrismaStores } from "@/services/infrastructure/prisma";
import { prisma } from "@/lib/server/db";
import { mockAssessmentEngine, mockGoalEngine, mockRoadmapEngine } from "@/services/engines";
import type { StoredAssessmentSession } from "@/services/ports/stores";
import type { LearningGoal } from "@/types/goal";
import type { Roadmap } from "@/types/roadmap";

const STUDENT = "student_contract_a";
const OTHER = "student_contract_b";

/** A goal created by the real engine, so the fixture is real domain data. */
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

/**
 * A roadmap whose goal is ALREADY persisted in the store under test.
 *
 * That ordering is not incidental: `Roadmap.goalId` is a real foreign key, so
 * writing the plan before its goal is a constraint violation. The fixture has
 * to respect the same dependency order the migration does.
 */
async function realRoadmap(
  goals: Harness["goals"],
  studentId: string,
  key: string,
): Promise<Roadmap> {
  const goal = await realGoal(studentId, key);
  await goals.upsert(goal);
  await mockGoalEngine.lockGoal(goal.id, studentId, `lock-${goal.id}`);
  // The lock bumped the goal, so the stored row has to follow it or the
  // roadmap would point at a goal version that no longer exists on disk.
  await goals.upsert(await mockGoalEngine.getGoal(goal.id, studentId) as LearningGoal);
  const { roadmap } = await mockRoadmapEngine.generateRoadmap(goal.id, studentId);
  return roadmap;
}

function realSession(studentId: string, id: string): StoredAssessmentSession {
  return {
    id,
    studentId,
    status: "in_progress",
    startedAt: "2026-09-01T08:00:00.000Z",
    responses: [],
    topics: {},
    lastTopic: null,
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

interface Harness {
  label: string;
  goals: ReturnType<typeof createStores>["goals"];
  roadmaps: ReturnType<typeof createStores>["roadmaps"];
  executions: ReturnType<typeof createStores>["executions"];
  assessmentSessions: ReturnType<typeof createStores>["assessmentSessions"];
  reset(): Promise<void>;
}

const memoryHarness: Harness = (() => {
  const stores = createStores("memory");
  return {
    label: "in-memory collections",
    goals: stores.goals,
    roadmaps: stores.roadmaps,
    executions: stores.executions,
    assessmentSessions: stores.assessmentSessions,
    reset: async () => stores.resetAll(),
  };
})();

const prismaHarness: Harness = {
  label: "Prisma / PostgreSQL",
  goals: createPrismaStores(prisma).goals,
  roadmaps: createPrismaStores(prisma).roadmaps,
  executions: createPrismaStores(prisma).executions,
  assessmentSessions: createPrismaStores(prisma).assessmentSessions,
  reset: async () => {
    await createPrismaStores(prisma).resetAll();
    // The foreign keys point at `User`, so the owners have to exist.
    for (const id of [STUDENT, OTHER]) {
      await prisma.user.upsert({
        where: { id },
        create: {
          id,
          email: `${id}@contract.test`,
          passwordHash: "x",
          name: id,
          role: "student",
          status: "active",
        },
        update: {},
      });
    }
  },
};

describe.each([memoryHarness, prismaHarness])("store contract — $label", (harness) => {
  beforeEach(async () => {
    await harness.reset();
    await mockGoalEngine.__reset();
    await mockRoadmapEngine.__reset();
    await mockAssessmentEngine.__reset();
  });

  it("round-trips a goal without losing or reshaping a single field", async () => {
    const goal = await realGoal(STUDENT, "rt-goal");
    await harness.goals.upsert(goal);

    // Deep equality against the object the engine produced is the whole
    // point: a JSON column that silently drops a key, or a Date that comes
    // back in a different representation, fails here rather than in
    // production.
    expect(await harness.goals.findById(goal.id)).toEqual(goal);
  });

  it("round-trips a roadmap with its milestones and learning units", async () => {
    const roadmap = await realRoadmap(harness.goals, STUDENT, "rt-roadmap");
    expect(roadmap.milestones.length).toBeGreaterThan(0);
    await harness.roadmaps.upsert(roadmap);

    expect(await harness.roadmaps.findById(roadmap.id)).toEqual(roadmap);
  });

  it("round-trips an assessment session including its answer key", async () => {
    const session = realSession(STUDENT, "asess_contract_rt");
    await harness.assessmentSessions.upsert(session);

    expect(await harness.assessmentSessions.findById(session.id)).toEqual(session);
  });

  it("scopes every list read to the owner", async () => {
    const mine = await realGoal(STUDENT, "own-mine");
    const theirs = await realGoal(OTHER, "own-theirs");
    await harness.goals.upsert(mine);
    await harness.goals.upsert(theirs);

    const listed = await harness.goals.listByStudent(STUDENT);
    expect(listed.map((g) => g.id)).toEqual([mine.id]);
    expect(listed.every((g) => g.studentId === STUDENT)).toBe(true);
  });

  it("returns undefined, not null or a throw, for an id it does not have", async () => {
    expect(await harness.goals.findById("no_such_goal")).toBeUndefined();
    expect(await harness.roadmaps.findById("no_such_roadmap")).toBeUndefined();
    expect(await harness.assessmentSessions.findById("no_such_session")).toBeUndefined();
  });

  it("updates in place — an upsert never leaves two rows behind", async () => {
    const goal = await realGoal(STUDENT, "upsert-twice");
    await harness.goals.upsert(goal);
    await harness.goals.upsert({ ...goal, desiredOutcome: "Changed later" });

    const listed = await harness.goals.listByStudent(STUDENT);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.desiredOutcome).toBe("Changed later");
  });

  it("preserves the domain's timestamps instead of substituting the database's", async () => {
    const goal = await realGoal(STUDENT, "timestamps");
    const locked = await mockGoalEngine.lockGoal(goal.id, STUDENT, `lock-ts-${goal.id}`);
    expect(locked.lockedAt).not.toBeNull();
    await harness.goals.upsert(locked);

    const stored = await harness.goals.findById(goal.id);
    // If the adapter let `@updatedAt` or `now()` win, these would drift.
    expect(stored?.updatedAt).toBe(locked.updatedAt);
    expect(stored?.lockedAt).toBe(locked.lockedAt);
    expect(stored?.createdAt).toBe(locked.createdAt);
  });

  it("runs a transaction's work and hands back its result", async () => {
    const goal = await realGoal(STUDENT, "tx-result");
    const outcome = await harness.goals.transaction(async () => {
      await harness.goals.upsert(goal);
      return goal.id;
    });

    expect(outcome).toBe(goal.id);
    expect(await harness.goals.findById(goal.id)).toBeDefined();
  });

  it("keeps execution records scoped to their roadmap", async () => {
    const roadmap = await realRoadmap(harness.goals, STUDENT, "exec-scope");
    await harness.roadmaps.upsert(roadmap);
    const firstMilestone = roadmap.milestones[0];
    const firstUnit = firstMilestone?.learningUnits[0];
    if (!firstMilestone || !firstUnit) throw new Error("the generated roadmap has no first unit");
    const execution = {
      id: "exec_contract_1",
      studentId: STUDENT,
      roadmapId: roadmap.id,
      milestoneId: firstMilestone.id,
      learningUnitId: firstUnit.id,
      status: "in_progress" as const,
      startedAt: "2026-09-02T09:00:00.000Z",
    };
    await harness.executions.upsert(execution);

    expect(await harness.executions.listByRoadmap(roadmap.id)).toEqual([execution]);
    expect(await harness.executions.listByRoadmap("some_other_roadmap")).toEqual([]);
  });

  it("clear() empties the store, so tests never inherit state", async () => {
    const goal = await realGoal(STUDENT, "clear-me");
    await harness.goals.upsert(goal);
    await harness.goals.clear();

    expect(await harness.goals.findById(goal.id)).toBeUndefined();
  });
});
