/**
 * Execution API integration — real handlers, real PostgreSQL.
 *
 * The chain under test is the whole one:
 *   HTTP → cookie → withStudent → validation → execution application
 *        → execution engine → ExecutionStore/RoadmapLookup ports
 *        → Prisma → PostgreSQL
 *
 * The prerequisite goal and roadmap are themselves created over their real
 * HTTP routes. No execution row is seeded by hand. This proves the planner's
 * persisted tree is what execution gates against.
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
import { POST as generateRoadmap } from "@/app/api/roadmaps/generate/route";
import { GET as getExecutionView } from "@/app/api/executions/view/route";
import { GET as getUnitContext } from "@/app/api/executions/units/[learningUnitId]/context/route";
import { POST as startUnit } from "@/app/api/executions/units/[learningUnitId]/start/route";
import { POST as submitEvidence } from "@/app/api/executions/units/[learningUnitId]/evidence/route";
import { POST as evaluateUnit } from "@/app/api/executions/units/[learningUnitId]/evaluate/route";
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

const TOKEN_A = "token_execution_a";
const TOKEN_B = "token_execution_b";
const STUDENT_A = "student_execution_a";
const STUDENT_B = "student_execution_b";

const SOLUTION = "I implemented a closure-backed counter and verified that its private count persists between calls.";
const REASONING = "The returned function closes over the lexical environment, so it retains access to count after makeCounter returns.";

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

async function createActiveRoadmap(key: string) {
  signInAs(TOKEN_A);
  const created = await callRoute(createGoal, jsonInit({ input: input(), idempotencyKey: `${key}-goal` }));
  expect(created.status).toBe(201);
  const { goal } = (await bodyOf(created)) as { goal: { id: string } };
  const locked = await lockGoal(
    new Request("https://mureeh.test/api/goals/x", jsonInit({ idempotencyKey: `${key}-lock` })),
    ctx("goalId", goal.id),
  );
  expect(locked.status).toBe(200);
  const generated = await callRoute(generateRoadmap, jsonInit({ goalId: goal.id }));
  expect(generated.status).toBe(201);
  const { roadmap } = (await bodyOf(generated)) as {
    roadmap: {
      id: string;
      milestones: { order: number; learningUnits: { id: string; order: number }[] }[];
    };
  };
  const orderedMilestones = [...roadmap.milestones].sort((a, b) => a.order - b.order);
  const orderedUnits = orderedMilestones.flatMap((milestone) =>
    [...milestone.learningUnits]
      .sort((a, b) => a.order - b.order)
      .map((unit) => unit.id),
  );
  return {
    roadmapId: roadmap.id,
    unitId: orderedUnits[0]!,
    blockedUnitId: orderedUnits[1]!,
  };
}

beforeEach(async () => {
  // This test suite owns only these users. Deleting them cascades its learning
  // rows without disturbing parallel goal/roadmap/assessment route suites.
  await prisma.user.deleteMany({ where: { id: { in: [STUDENT_A, STUDENT_B] } } });
  await seedUsers(STUDENT_A, STUDENT_B);
  sessions.clear();
  sessions.set(TOKEN_A, { id: STUDENT_A, role: "student" });
  sessions.set(TOKEN_B, { id: STUDENT_B, role: "student" });
  signInAs(undefined);
});

describe("execution routes — authentication and input boundary", () => {
  it("requires an authenticated student for the view", async () => {
    const res = await callRoute(getExecutionView);
    expect(res.status).toBe(401);
  });

  it("requires an authenticated student for start and evidence mutations", async () => {
    const start = await startUnit(
      new Request("https://mureeh.test/api/executions/unit", bareInit()),
      ctx("learningUnitId", "unit_missing"),
    );
    expect(start.status).toBe(401);

    const evidence = await submitEvidence(
      new Request("https://mureeh.test/api/executions/unit", jsonInit({ solution: "x", reasoning: "y" })),
      ctx("learningUnitId", "unit_missing"),
    );
    expect(evidence.status).toBe(401);
  });

  it("rejects malformed path ids and oversized evidence before engine work", async () => {
    signInAs(TOKEN_A);
    const badPath = await startUnit(
      new Request("https://mureeh.test/api/executions/unit", bareInit()),
      ctx("learningUnitId", "x".repeat(65)),
    );
    expect(badPath.status).toBe(400);

    const tooLong = await submitEvidence(
      new Request(
        "https://mureeh.test/api/executions/unit",
        jsonInit({ solution: "x".repeat(4001), reasoning: "y" }),
      ),
      ctx("learningUnitId", "unit_missing"),
    );
    expect(tooLong.status).toBe(400);
  });
});

describe("execution HTTP lifecycle — real plan, real rows", () => {
  it("view and context are derived from the persisted active roadmap", async () => {
    const { roadmapId, unitId } = await createActiveRoadmap("exec-view");
    signInAs(TOKEN_A);

    const view = await callRoute(getExecutionView);
    expect(view.status).toBe(200);
    const projection = (await bodyOf(view)) as {
      roadmapId: string;
      roadmapStatus: string;
      currentUnit: { id: string } | null;
      unitStates: Record<string, string>;
    };
    expect(projection.roadmapId).toBe(roadmapId);
    expect(projection.roadmapStatus).toBe("active");
    expect(projection.currentUnit?.id).toBe(unitId);
    expect(projection.unitStates[unitId]).toBe("available");

    const context = await getUnitContext(
      new Request("https://mureeh.test/api/executions/unit"),
      ctx("learningUnitId", unitId),
    );
    expect(context.status).toBe(200);
    const data = (await bodyOf(context)) as {
      roadmap: { id: string };
      unit: { id: string };
      execution: unknown;
      status: string;
    };
    expect(data.roadmap.id).toBe(roadmapId);
    expect(data.unit.id).toBe(unitId);
    expect(data.execution).toBeNull();
    expect(data.status).toBe("available");
  });

  it("starts idempotently and writes exactly one execution row", async () => {
    const { roadmapId, unitId } = await createActiveRoadmap("exec-start");
    signInAs(TOKEN_A);

    const start = () =>
      startUnit(new Request("https://mureeh.test/api/executions/unit", bareInit()), ctx("learningUnitId", unitId));
    const first = await start();
    expect(first.status).toBe(200);
    const created = (await bodyOf(first)) as { id: string; status: string; roadmapId: string };
    expect(created.status).toBe("in_progress");
    expect(created.roadmapId).toBe(roadmapId);

    const replay = await start();
    expect(replay.status).toBe(200);
    expect((await bodyOf(replay)).id).toBe(created.id);
    expect(await prisma.learningUnitExecution.count({ where: { roadmapId, studentId: STUDENT_A } })).toBe(1);
  });

  it("records evidence then derives the verdict server-side", async () => {
    const { roadmapId, unitId } = await createActiveRoadmap("exec-evidence");
    signInAs(TOKEN_A);
    await startUnit(new Request("https://mureeh.test/api/executions/unit", bareInit()), ctx("learningUnitId", unitId));

    const submitted = await submitEvidence(
      new Request(
        "https://mureeh.test/api/executions/unit",
        jsonInit({ solution: SOLUTION, reasoning: REASONING, result: "passed", correct: true, studentId: STUDENT_B }),
      ),
      ctx("learningUnitId", unitId),
    );
    expect(submitted.status).toBe(200);
    const submittedBody = (await bodyOf(submitted)) as { result: string | null; status: string; evidence: unknown };
    expect(submittedBody.status).toBe("submitted");
    // The domain contract leaves an unevaluated verdict absent (not null).
    // The database scalar is NULL until the evaluator writes it below.
    expect(submittedBody.result).toBeUndefined();

    const rowBeforeEvaluation = await prisma.learningUnitExecution.findFirst({ where: { roadmapId, studentId: STUDENT_A } });
    expect(rowBeforeEvaluation?.status).toBe("submitted");
    expect(rowBeforeEvaluation?.result).toBeNull();
    expect(rowBeforeEvaluation?.studentId).toBe(STUDENT_A);

    const evaluated = await evaluateUnit(
      new Request("https://mureeh.test/api/executions/unit", bareInit()),
      ctx("learningUnitId", unitId),
    );
    expect(evaluated.status).toBe(200);
    const result = (await bodyOf(evaluated)) as { result: string; status: string };
    expect(result.result).toBe("passed");
    expect(result.status).toBe("evaluated");

    const rowAfterEvaluation = await prisma.learningUnitExecution.findFirst({ where: { roadmapId, studentId: STUDENT_A } });
    expect(rowAfterEvaluation?.result).toBe("passed");
  });

  it("does not expose or let B mutate A's execution through any HTTP operation", async () => {
    const { roadmapId, unitId } = await createActiveRoadmap("exec-owner");
    signInAs(TOKEN_A);
    await startUnit(
      new Request("https://mureeh.test/api/executions/unit", bareInit()),
      ctx("learningUnitId", unitId),
    );
    const ownerEvidence = await submitEvidence(
      new Request("https://mureeh.test/api/executions/unit", jsonInit({ solution: SOLUTION, reasoning: REASONING })),
      ctx("learningUnitId", unitId),
    );
    expect(ownerEvidence.status).toBe(200);
    const storedBefore = await prisma.learningUnitExecution.findFirst({ where: { roadmapId, studentId: STUDENT_A } });
    expect(storedBefore?.status).toBe("submitted");
    signInAs(TOKEN_B);

    const context = await getUnitContext(
      new Request("https://mureeh.test/api/executions/unit"),
      ctx("learningUnitId", unitId),
    );
    // The engine resolves B's active roadmap first. B has none, so the
    // response is the domain's non-leaking `unit_unavailable` (not A's data).
    expect(context.status).toBe(409);
    expect(await bodyOf(context)).toEqual({ code: "unit_unavailable" });

    const start = await startUnit(
      new Request("https://mureeh.test/api/executions/unit", bareInit()),
      ctx("learningUnitId", unitId),
    );
    expect(start.status).toBe(409);

    const evidence = await submitEvidence(
      new Request(
        "https://mureeh.test/api/executions/unit",
        jsonInit({ solution: "B tries to overwrite A", reasoning: "forged" }),
      ),
      ctx("learningUnitId", unitId),
    );
    expect(evidence.status).toBe(409);

    const evaluated = await evaluateUnit(
      new Request("https://mureeh.test/api/executions/unit", bareInit()),
      ctx("learningUnitId", unitId),
    );
    expect(evaluated.status).toBe(409);

    const storedAfter = await prisma.learningUnitExecution.findFirst({ where: { roadmapId, studentId: STUDENT_A } });
    expect(storedAfter?.status).toBe("submitted");
    expect(storedAfter?.evidence).toEqual(storedBefore?.evidence);
    expect(storedAfter?.result).toBeNull();

    const view = await callRoute(getExecutionView);
    expect(await view.json()).toBeNull();
  });

  it("a blocked dependency cannot be skipped by sending status or result fields", async () => {
    const { roadmapId, unitId: firstUnitId, blockedUnitId } = await createActiveRoadmap("exec-gate");
    signInAs(TOKEN_A);

    const attempted = await startUnit(
      new Request(
        "https://mureeh.test/api/executions/unit",
        jsonInit({ status: "passed", result: "passed", studentId: STUDENT_A }),
      ),
      ctx("learningUnitId", blockedUnitId),
    );
    expect(attempted.status).toBe(409);
    expect(await bodyOf(attempted)).toEqual({ code: "unit_unavailable" });
    expect(await prisma.learningUnitExecution.count({ where: { roadmapId } })).toBe(0);
    expect(firstUnitId).not.toBe(blockedUnitId);
  });

  it("keeps the domain's evidence error classification through HTTP", async () => {
    const { unitId } = await createActiveRoadmap("exec-domain-error");
    signInAs(TOKEN_A);
    await startUnit(new Request("https://mureeh.test/api/executions/unit", bareInit()), ctx("learningUnitId", unitId));

    const empty = await submitEvidence(
      new Request("https://mureeh.test/api/executions/unit", jsonInit({ solution: "", reasoning: "" })),
      ctx("learningUnitId", unitId),
    );
    expect(empty.status).toBe(422);
    expect(await bodyOf(empty)).toEqual({ code: "evidence_invalid" });

    const earlyEvaluate = await evaluateUnit(
      new Request("https://mureeh.test/api/executions/unit", bareInit()),
      ctx("learningUnitId", unitId),
    );
    expect(earlyEvaluate.status).toBe(409);
    expect(await bodyOf(earlyEvaluate)).toEqual({ code: "invalid_transition" });
  });

  it("a malformed or foreign unit id never reveals a unit", async () => {
    const { unitId } = await createActiveRoadmap("exec-not-found");
    signInAs(TOKEN_A);
    const missing = await getUnitContext(
      new Request("https://mureeh.test/api/executions/unit"),
      ctx("learningUnitId", "unit_does_not_exist"),
    );
    expect(missing.status).toBe(404);
    expect(await bodyOf(missing)).toEqual({ code: "execution_not_found" });

    const longId = await getUnitContext(
      new Request("https://mureeh.test/api/executions/unit"),
      ctx("learningUnitId", "x".repeat(65)),
    );
    expect(longId.status).toBe(400);
    expect(unitId).not.toBe("unit_does_not_exist");
  });
});
