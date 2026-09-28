/**
 * Roadmap API integration — real handlers, real PostgreSQL.
 *
 * HTTP → cookie → withStudent → validation → roadmap application service
 *      → planner/domain engine → RoadmapStore → Prisma → PostgreSQL.
 *
 * A roadmap is generated from a goal created and locked over HTTP in this
 * suite. No test fixture writes roadmap rows directly: this proves the real
 * planner, its goal dependency, its structure validation and its persistence
 * all sit on the request path.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth/gateway", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { createGatewayModule } = await import("@/test/route-harness");
  return createGatewayModule(actual);
});

vi.mock("next/headers", async () => {
  const { createHeadersModule } = await import("@/test/route-harness");
  return createHeadersModule();
});

import { POST as createGoal } from "@/app/api/goals/route";
import { POST as lockGoal } from "@/app/api/goals/[goalId]/lock/route";
import { GET as getActiveRoadmap } from "@/app/api/roadmaps/active/route";
import { POST as generateRoadmap } from "@/app/api/roadmaps/generate/route";
import { GET as getRoadmap } from "@/app/api/roadmaps/[roadmapId]/route";
import { POST as pauseRoadmap } from "@/app/api/roadmaps/[roadmapId]/pause/route";
import { POST as resumeRoadmap } from "@/app/api/roadmaps/[roadmapId]/resume/route";
import { prisma } from "@/lib/server/db";
import {
  bareInit,
  bodyOf,
  callRoute,
  ctx,
  jsonInit,
  seedUsers,
  sessions,
  signInAs,
} from "@/test/route-harness";
import type { GoalDiscoveryInput } from "@/types/goal";

const TOKEN_A = "token_roadmap_a";
const TOKEN_B = "token_roadmap_b";
const STUDENT_A = "student_roadmap_a";
const STUDENT_B = "student_roadmap_b";

function input(): GoalDiscoveryInput {
  return {
    targetDomain: { kind: "preset", presetId: "javascript" },
    desiredOutcome: "Build and deploy two practical JavaScript apps with tests and clean code",
    motivation: { kind: "career" },
    currentLevel: "developing",
    targetLevel: "build_independently",
    timeframe: { weeks: 24, preset: true },
    weeklyCommitment: { hoursPerWeek: 7, preset: true },
    constraints: [],
  };
}

async function createLockedGoal(token = TOKEN_A, key = "roadmap-goal") {
  signInAs(token);
  const created = await callRoute(createGoal, jsonInit({ input: input(), idempotencyKey: key }));
  expect(created.status).toBe(201);
  const { goal } = (await bodyOf(created)) as { goal: { id: string } };
  const locked = await lockGoal(
    new Request("https://mureeh.test/api/goals/x", jsonInit({ idempotencyKey: `${key}-lock` })),
    ctx("goalId", goal.id),
  );
  expect(locked.status).toBe(200);
  return goal.id;
}

async function generateAs(token: string, goalId: string) {
  signInAs(token);
  return callRoute(generateRoadmap, jsonInit({ goalId }));
}

beforeEach(async () => {
  // User-scoped delete cascades to only this suite's rows. Never truncate a
  // shared table: route suites may run concurrently against the same DB.
  await prisma.user.deleteMany({ where: { id: { in: [STUDENT_A, STUDENT_B] } } });
  await seedUsers(STUDENT_A, STUDENT_B);
  sessions.clear();
  sessions.set(TOKEN_A, { id: STUDENT_A, role: "student" });
  sessions.set(TOKEN_B, { id: STUDENT_B, role: "student" });
  signInAs(undefined);
});

describe("POST /api/roadmaps/generate — authenticated planner path", () => {
  it("rejects unauthenticated requests before planning", async () => {
    const res = await callRoute(generateRoadmap, jsonInit({ goalId: "anything" }));
    expect(res.status).toBe(401);
    expect(await prisma.roadmap.count({ where: { studentId: STUDENT_A } })).toBe(0);
  });

  it("validates the body before domain work", async () => {
    signInAs(TOKEN_A);
    const res = await callRoute(generateRoadmap, jsonInit({ goalId: "", milestones: [] }));
    expect(res.status).toBe(400);
    expect(await prisma.roadmap.count({ where: { studentId: STUDENT_A } })).toBe(0);
  });

  it("generates from the owner's locked goal and persists the real plan", async () => {
    const goalId = await createLockedGoal();
    const res = await generateAs(TOKEN_A, goalId);
    expect(res.status).toBe(201);

    const result = (await bodyOf(res)) as {
      created: boolean;
      roadmap: { id: string; studentId: string; goalId: string; milestones: unknown[] };
    };
    expect(result.created).toBe(true);
    expect(result.roadmap.studentId).toBe(STUDENT_A);
    expect(result.roadmap.goalId).toBe(goalId);
    expect(result.roadmap.milestones.length).toBeGreaterThan(1);

    const row = await prisma.roadmap.findUnique({ where: { id: result.roadmap.id } });
    expect(row?.studentId).toBe(STUDENT_A);
    expect(row?.goalId).toBe(goalId);
    expect(await prisma.roadmapMilestone.count({ where: { roadmapId: result.roadmap.id } })).toBeGreaterThan(1);
    expect(await prisma.learningUnit.count({ where: { roadmapId: result.roadmap.id } })).toBeGreaterThan(1);
  });

  it("does not trust a body studentId; the plan belongs to the session student", async () => {
    const goalId = await createLockedGoal();
    signInAs(TOKEN_A);
    const res = await callRoute(
      generateRoadmap,
      jsonInit({ goalId, studentId: STUDENT_B, milestones: [{ status: "completed" }] }),
    );
    expect(res.status).toBe(201);
    const body = (await bodyOf(res)) as { roadmap: { studentId: string } };
    expect(body.roadmap.studentId).toBe(STUDENT_A);
    expect(await prisma.roadmap.count({ where: { studentId: STUDENT_B } })).toBe(0);
  });

  it("will not plan another student's locked goal", async () => {
    const goalId = await createLockedGoal(TOKEN_A, "foreign-goal");
    const res = await generateAs(TOKEN_B, goalId);
    expect(res.status).toBe(403);
    expect(await bodyOf(res)).toEqual({ code: "forbidden" });
    expect(await prisma.roadmap.count({ where: { studentId: STUDENT_B } })).toBe(0);
  });

  it("requires an existing locked goal; an editable goal is not enough", async () => {
    signInAs(TOKEN_A);
    const created = await callRoute(createGoal, jsonInit({ input: input(), idempotencyKey: "unlocked" }));
    const { goal } = (await bodyOf(created)) as { goal: { id: string } };
    const res = await generateAs(TOKEN_A, goal.id);
    expect(res.status).toBe(409);
    expect(await bodyOf(res)).toEqual({ code: "no_locked_goal" });
    expect(await prisma.roadmap.count({ where: { studentId: STUDENT_A } })).toBe(0);
  });

  it("is idempotent across repeated HTTP calls", async () => {
    const goalId = await createLockedGoal();
    const first = await generateAs(TOKEN_A, goalId);
    const a = (await bodyOf(first)) as { created: boolean; roadmap: { id: string } };
    expect(a.created).toBe(true);

    const second = await generateAs(TOKEN_A, goalId);
    expect(second.status).toBe(200);
    const b = (await bodyOf(second)) as { created: boolean; roadmap: { id: string } };
    expect(b.created).toBe(false);
    expect(b.roadmap.id).toBe(a.roadmap.id);
    expect(await prisma.roadmap.count({ where: { studentId: STUDENT_A } })).toBe(1);
  });
});

describe("roadmap ownership and state transitions over HTTP", () => {
  it("returns null for an owner with no plan and never leaks another student's", async () => {
    const goalId = await createLockedGoal(TOKEN_A, "owner-active");
    await generateAs(TOKEN_A, goalId);

    signInAs(TOKEN_A);
    const owner = await callRoute(getActiveRoadmap);
    expect(owner.status).toBe(200);
    const ownerBody = (await bodyOf(owner)) as { studentId: string };
    expect(ownerBody.studentId).toBe(STUDENT_A);

    signInAs(TOKEN_B);
    const other = await callRoute(getActiveRoadmap);
    expect(other.status).toBe(200);
    expect(await other.json()).toBeNull();
  });

  it("GET by id: owner succeeds; non-owner receives the domain's 404", async () => {
    const goalId = await createLockedGoal(TOKEN_A, "owner-get");
    const generated = await generateAs(TOKEN_A, goalId);
    const { roadmap } = (await bodyOf(generated)) as { roadmap: { id: string } };

    signInAs(TOKEN_A);
    const owner = await getRoadmap(
      new Request("https://mureeh.test/api/roadmaps/x"),
      ctx("roadmapId", roadmap.id),
    );
    expect(owner.status).toBe(200);

    signInAs(TOKEN_B);
    const other = await getRoadmap(
      new Request("https://mureeh.test/api/roadmaps/x"),
      ctx("roadmapId", roadmap.id),
    );
    expect(other.status).toBe(404);
    expect(await bodyOf(other)).toEqual({ code: "roadmap_not_found" });
  });

  it("non-owner cannot pause or resume a roadmap", async () => {
    const goalId = await createLockedGoal(TOKEN_A, "owner-transition");
    const generated = await generateAs(TOKEN_A, goalId);
    const { roadmap } = (await bodyOf(generated)) as { roadmap: { id: string } };
    signInAs(TOKEN_B);

    const paused = await pauseRoadmap(
      new Request("https://mureeh.test/api/roadmaps/x", bareInit()),
      ctx("roadmapId", roadmap.id),
    );
    expect(paused.status).toBe(404);
    expect(await bodyOf(paused)).toEqual({ code: "roadmap_not_found" });

    const resumed = await resumeRoadmap(
      new Request("https://mureeh.test/api/roadmaps/x", bareInit()),
      ctx("roadmapId", roadmap.id),
    );
    expect(resumed.status).toBe(404);
    expect(await bodyOf(resumed)).toEqual({ code: "roadmap_not_found" });

    expect((await prisma.roadmap.findUnique({ where: { id: roadmap.id } }))?.status).toBe("active");
  });

  it("owner pause/resume are real state transitions persisted in PostgreSQL", async () => {
    const goalId = await createLockedGoal(TOKEN_A, "owner-pause");
    const generated = await generateAs(TOKEN_A, goalId);
    const { roadmap } = (await bodyOf(generated)) as { roadmap: { id: string } };
    signInAs(TOKEN_A);

    const paused = await pauseRoadmap(
      new Request("https://mureeh.test/api/roadmaps/x", bareInit()),
      ctx("roadmapId", roadmap.id),
    );
    expect(paused.status).toBe(200);
    expect((await bodyOf(paused)).status).toBe("paused");
    expect((await prisma.roadmap.findUnique({ where: { id: roadmap.id } }))?.status).toBe("paused");

    const resumed = await resumeRoadmap(
      new Request("https://mureeh.test/api/roadmaps/x", bareInit()),
      ctx("roadmapId", roadmap.id),
    );
    expect(resumed.status).toBe(200);
    expect((await bodyOf(resumed)).status).toBe("active");
    expect((await prisma.roadmap.findUnique({ where: { id: roadmap.id } }))?.status).toBe("active");
  });

  it("rejects malformed path ids before querying", async () => {
    signInAs(TOKEN_A);
    const res = await getRoadmap(
      new Request("https://mureeh.test/api/roadmaps/x"),
      ctx("roadmapId", "x".repeat(65)),
    );
    expect(res.status).toBe(400);
  });
});
