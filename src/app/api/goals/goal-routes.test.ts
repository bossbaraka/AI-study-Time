/**
 * Goal API integration — real handlers, real PostgreSQL.
 *
 * The chain under test is the whole one:
 *   HTTP → cookie → withStudent → validation → application service
 *        → goal engine → GoalStore port → Prisma → PostgreSQL
 *
 * Nothing is stubbed except session resolution (see `src/test/route-harness.ts`).
 * Assertions that matter are the ones TypeScript cannot make: that the row is
 * actually in the database, that student B cannot read student A's goal, and
 * that a body naming another student is ignored rather than trusted.
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
import { GET as getActiveGoal } from "@/app/api/goals/active/route";
import { GET as getGoal, PATCH as updateGoal } from "@/app/api/goals/[goalId]/route";
import { GET as getValidation } from "@/app/api/goals/[goalId]/validation/route";
import { POST as lockGoal } from "@/app/api/goals/[goalId]/lock/route";
import { POST as reviseGoal } from "@/app/api/goals/[goalId]/revise/route";
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

const TOKEN_A = "token_goal_a";
const TOKEN_B = "token_goal_b";
const TOKEN_GUARDIAN = "token_goal_guardian";
const STUDENT_A = "student_goal_a";
const STUDENT_B = "student_goal_b";

function input(overrides: Partial<GoalDiscoveryInput> = {}): GoalDiscoveryInput {
  return {
    targetDomain: { kind: "preset", presetId: "backend" },
    desiredOutcome:
      "Build and deploy two practical backend applications with a real database and authentication",
    motivation: { kind: "career" },
    currentLevel: "developing",
    targetLevel: "build_independently",
    timeframe: { weeks: 12, preset: true },
    weeklyCommitment: { hoursPerWeek: 7, preset: true },
    constraints: [],
    ...overrides,
  };
}

/** Creates a goal through the real HTTP endpoint, as the given student. */
async function createAs(token: string, key: string) {
  signInAs(token);
  const res = await callRoute(createGoal, jsonInit({ input: input(), idempotencyKey: key }));
  expect(res.status).toBe(201);
  const body = (await bodyOf(res)) as { goal: { id: string; status: string } };
  return body.goal;
}

beforeEach(async () => {
  // Isolate by this suite's own owners; never truncate shared learning tables
  // while another route suite may be exercising PostgreSQL concurrently.
  const owners = [STUDENT_A, STUDENT_B, "guardian_goal"];
  await prisma.learningUnitExecution.deleteMany({ where: { studentId: { in: owners } } });
  await prisma.learningUnit.deleteMany({ where: { roadmap: { studentId: { in: owners } } } });
  await prisma.roadmapMilestone.deleteMany({ where: { roadmap: { studentId: { in: owners } } } });
  await prisma.roadmap.deleteMany({ where: { studentId: { in: owners } } });
  await prisma.goal.deleteMany({ where: { studentId: { in: owners } } });
  await seedUsers(...owners);

  sessions.clear();
  sessions.set(TOKEN_A, { id: STUDENT_A, role: "student" });
  sessions.set(TOKEN_B, { id: STUDENT_B, role: "student" });
  sessions.set(TOKEN_GUARDIAN, { id: "guardian_goal", role: "guardian" });
  signInAs(undefined);
});

/* ------------------------------------------------------------------ */
/* Authentication and the identity boundary                            */
/* ------------------------------------------------------------------ */

describe("POST /api/goals — identity", () => {
  it("refuses an anonymous caller before any domain work happens", async () => {
    const res = await callRoute(createGoal, jsonInit({ input: input(), idempotencyKey: "k1" }));
    expect(res.status).toBe(401);
    expect(await prisma.goal.count({ where: { studentId: { in: [STUDENT_A, STUDENT_B] } } })).toBe(0);
  });

  it("refuses a guardian: goals belong to students", async () => {
    signInAs(TOKEN_GUARDIAN);
    const res = await callRoute(createGoal, jsonInit({ input: input(), idempotencyKey: "k2" }));
    expect(res.status).toBe(403);
    expect(await prisma.goal.count({ where: { studentId: { in: [STUDENT_A, STUDENT_B] } } })).toBe(0);
  });

  it("binds the goal to the cookie's student and ignores a studentId in the body", async () => {
    signInAs(TOKEN_A);
    const res = await callRoute(
      createGoal,
      // A crafted body naming student B must change nothing.
      jsonInit({
        input: input(),
        idempotencyKey: "k3",
        studentId: STUDENT_B,
        diagnosisContext: { sessionId: "forged", strengths: ["everything"], confidence: "high" },
      }),
    );
    expect(res.status).toBe(201);

    const rows = await prisma.goal.findMany({ where: { studentId: STUDENT_A } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.studentId).toBe(STUDENT_A);
    expect(rows[0]?.diagnosisContext).toBeNull();
  });

  it("rejects a payload the schema does not allow", async () => {
    signInAs(TOKEN_A);
    const res = await callRoute(
      createGoal,
      jsonInit({ input: input({ currentLevel: "grandmaster" as never }), idempotencyKey: "k4" }),
    );
    expect(res.status).toBe(400);
    expect(await prisma.goal.count({ where: { studentId: { in: [STUDENT_A, STUDENT_B] } } })).toBe(0);
  });

  it("rejects an unbounded desiredOutcome rather than storing it", async () => {
    signInAs(TOKEN_A);
    const res = await callRoute(
      createGoal,
      jsonInit({ input: input({ desiredOutcome: "x".repeat(4001) }), idempotencyKey: "k5" }),
    );
    expect(res.status).toBe(400);
  });
});

/* ------------------------------------------------------------------ */
/* Persistence — the route really reaches PostgreSQL                   */
/* ------------------------------------------------------------------ */

describe("POST /api/goals — persistence", () => {
  it("writes a row the database can be queried for", async () => {
    const goal = await createAs(TOKEN_A, "persist-1");

    const row = await prisma.goal.findUnique({ where: { id: goal.id } });
    expect(row).not.toBeNull();
    expect(row?.studentId).toBe(STUDENT_A);
    expect(row?.desiredOutcome).toContain("backend applications");
    // The engine owns timestamps; the database must not have substituted its
    // own. Compare against what the API served, not against `now()`.
    signInAs(TOKEN_A);
    const served = await bodyOf(await getGoal(new Request("https://mureeh.test/api/goals/x"), ctx("goalId", goal.id)));
    expect(row?.createdAt.toISOString()).toBe(served.createdAt);
  });

  it("replays an idempotent creation instead of creating a second goal", async () => {
    const first = await createAs(TOKEN_A, "idem-1");
    signInAs(TOKEN_A);
    const again = await callRoute(createGoal, jsonInit({ input: input(), idempotencyKey: "idem-1" }));

    const second = (await bodyOf(again)) as { goal: { id: string } };
    expect(second.goal.id).toBe(first.id);
    expect(await prisma.goal.count({ where: { studentId: STUDENT_A } })).toBe(1);
  });

  it("lets two students reuse one idempotency key — ownership is part of the key", async () => {
    await createAs(TOKEN_A, "shared-key");
    await createAs(TOKEN_B, "shared-key");
    expect(await prisma.goal.count({ where: { createIdempotencyKey: "shared-key" } })).toBe(2);
  });
});

/* ------------------------------------------------------------------ */
/* Ownership — the property that must survive the whole chain          */
/* ------------------------------------------------------------------ */

describe("goal ownership over HTTP (§8)", () => {
  it("gives student A their goal and student B a 403", async () => {
    const goal = await createAs(TOKEN_A, "own-1");

    signInAs(TOKEN_A);
    const mine = await getGoal(new Request("https://mureeh.test/api/goals/x"), ctx("goalId", goal.id));
    expect(mine.status).toBe(200);
    expect((await bodyOf(mine)).id).toBe(goal.id);

    signInAs(TOKEN_B);
    const theirs = await getGoal(new Request("https://mureeh.test/api/goals/x"), ctx("goalId", goal.id));
    expect(theirs.status).toBe(403);
    expect(await bodyOf(theirs)).toEqual({ code: "forbidden" });
  });

  it("answers 404 for an id that does not exist", async () => {
    signInAs(TOKEN_A);
    const res = await getGoal(new Request("https://mureeh.test/api/goals/x"), ctx("goalId", "no_such_goal"));
    expect(res.status).toBe(404);
    expect(await bodyOf(res)).toEqual({ code: "goal_not_found" });
  });

  it("scopes /active to the caller — B never sees A's goal", async () => {
    await createAs(TOKEN_A, "active-1");

    signInAs(TOKEN_A);
    const a = await callRoute(getActiveGoal);
    expect((await bodyOf(a)).id).toBeTruthy();

    signInAs(TOKEN_B);
    const b = await callRoute(getActiveGoal);
    // `null` is the honest answer: B has no goal. Not A's goal, not an error.
    expect(await b.json()).toBeNull();
  });

  it("rejects B's attempts to update, validate, lock and revise A's goal", async () => {
    const goal = await createAs(TOKEN_A, "own-2");
    signInAs(TOKEN_B);

    const updated = await updateGoal(
      new Request("https://mureeh.test/api/goals/x", jsonInit({ desiredOutcome: "Hijacked" }, "PATCH")),
      ctx("goalId", goal.id),
    );
    expect(updated.status).toBe(403);

    const validated = await getValidation(
      new Request("https://mureeh.test/api/goals/x"),
      ctx("goalId", goal.id),
    );
    expect(validated.status).toBe(403);

    const locked = await lockGoal(
      new Request("https://mureeh.test/api/goals/x", jsonInit({ idempotencyKey: "steal" })),
      ctx("goalId", goal.id),
    );
    expect(locked.status).toBe(403);

    const revised = await reviseGoal(
      new Request("https://mureeh.test/api/goals/x", bareInit()),
      ctx("goalId", goal.id),
    );
    expect(revised.status).toBe(403);

    // None of them landed.
    const row = await prisma.goal.findUnique({ where: { id: goal.id } });
    expect(row?.desiredOutcome).toContain("backend applications");
    expect(row?.status).not.toBe("locked");
    expect(row?.status).not.toBe("revised");
  });
});

/* ------------------------------------------------------------------ */
/* Domain rules — the state machine, not the client, decides           */
/* ------------------------------------------------------------------ */

describe("goal transitions over HTTP (§15)", () => {
  it("locks a valid goal and records it in the database", async () => {
    const goal = await createAs(TOKEN_A, "lock-1");
    signInAs(TOKEN_A);

    const res = await lockGoal(
      new Request("https://mureeh.test/api/goals/x", jsonInit({ idempotencyKey: "lock-key" })),
      ctx("goalId", goal.id),
    );
    expect(res.status).toBe(200);
    const locked = (await bodyOf(res)) as { status: string; lockedAt: string | null };
    expect(locked.status).toBe("locked");
    expect(locked.lockedAt).not.toBeNull();

    const row = await prisma.goal.findUnique({ where: { id: goal.id } });
    expect(row?.status).toBe("locked");
    expect(row?.lockIdempotencyKey).toBe("lock-key");
  });

  it("refuses to update a locked goal — revision is the only way", async () => {
    const goal = await createAs(TOKEN_A, "lock-2");
    signInAs(TOKEN_A);
    await lockGoal(
      new Request("https://mureeh.test/api/goals/x", jsonInit({ idempotencyKey: "lk" })),
      ctx("goalId", goal.id),
    );

    const res = await updateGoal(
      new Request(
        "https://mureeh.test/api/goals/x",
        jsonInit({ desiredOutcome: "Changed after locking" }, "PATCH"),
      ),
      ctx("goalId", goal.id),
    );
    expect(res.status).toBe(409);
    expect(await bodyOf(res)).toEqual({ code: "invalid_transition" });
  });

  it("revises a locked goal: the original is kept, an editable copy appears", async () => {
    const goal = await createAs(TOKEN_A, "rev-1");
    signInAs(TOKEN_A);
    await lockGoal(
      new Request("https://mureeh.test/api/goals/x", jsonInit({ idempotencyKey: "lk2" })),
      ctx("goalId", goal.id),
    );

    const res = await reviseGoal(
      new Request("https://mureeh.test/api/goals/x", bareInit()),
      ctx("goalId", goal.id),
    );
    expect(res.status).toBe(201);
    const revision = (await bodyOf(res)) as { goal: { id: string; revisesGoalId?: string } };
    expect(revision.goal.id).not.toBe(goal.id);
    expect(revision.goal.revisesGoalId).toBe(goal.id);

    // Both rows exist — history is kept, not overwritten (§13 atomicity).
    const rows = await prisma.goal.findMany({ where: { studentId: STUDENT_A } });
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.id === goal.id)?.status).toBe("revised");
  });

  it("refuses to revise a goal that was never locked", async () => {
    const goal = await createAs(TOKEN_A, "rev-2");
    signInAs(TOKEN_A);
    const res = await reviseGoal(
      new Request("https://mureeh.test/api/goals/x", bareInit()),
      ctx("goalId", goal.id),
    );
    expect(res.status).toBe(409);
    expect(await bodyOf(res)).toEqual({ code: "invalid_transition" });
  });

  it("re-runs validation without mutating the goal", async () => {
    const goal = await createAs(TOKEN_A, "val-1");
    signInAs(TOKEN_A);

    const res = await getValidation(
      new Request("https://mureeh.test/api/goals/x"),
      ctx("goalId", goal.id),
    );
    expect(res.status).toBe(200);
    const verdict = (await bodyOf(res)) as { valid: boolean; overall: string; evaluatedAt: string };
    // The rules really ran: a verdict with a timestamp, not an empty object.
    expect(typeof verdict.valid).toBe("boolean");
    expect(verdict.overall).toBeTruthy();
    expect(verdict.evaluatedAt).toBeTruthy();

    const row = await prisma.goal.findUnique({ where: { id: goal.id } });
    expect(row?.version).toBe(1); // a read did not bump the version
    expect(row?.updatedAt.toISOString()).toBe(row?.createdAt.toISOString());
  });

  it("rejects an empty refinement patch as a client bug", async () => {
    const goal = await createAs(TOKEN_A, "patch-1");
    signInAs(TOKEN_A);
    const res = await updateGoal(
      new Request("https://mureeh.test/api/goals/x", jsonInit({}, "PATCH")),
      ctx("goalId", goal.id),
    );
    expect(res.status).toBe(400);
  });

  it("cannot write a status: there is no status field to write", async () => {
    const goal = await createAs(TOKEN_A, "patch-2");
    signInAs(TOKEN_A);
    const res = await updateGoal(
      new Request(
        "https://mureeh.test/api/goals/x",
        jsonInit({ status: "locked", studentId: STUDENT_B }, "PATCH"),
      ),
      ctx("goalId", goal.id),
    );
    // Zod strips unknown keys, so nothing here is an error — but nothing is
    // written either. The goal is still exactly what the engine made it.
    expect(res.status).toBe(400); // empty after stripping → rejected as empty
    const row = await prisma.goal.findUnique({ where: { id: goal.id } });
    expect(row?.status).not.toBe("locked");
    expect(row?.studentId).toBe(STUDENT_A);
  });
});
