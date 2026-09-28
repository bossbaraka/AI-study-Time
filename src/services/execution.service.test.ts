/**
 * Execution service contract (§15/§18/§19): identity from the session,
 * typed error funnel, idempotent operations through the async seam,
 * cross-student isolation.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { authService } from "@/services/auth.service";
import { ExecutionApiError, executionService } from "@/services/execution.service";
import { mockExecutionEngine } from "@/services/engines";
import { mockGoalEngine } from "@/services/engines";
import { mockRoadmapEngine } from "@/services/engines";
import type { GoalDiscoveryInput } from "@/types/goal";
import type { Roadmap } from "@/types/roadmap";

const PASSWORD = "securePass1";
const STUDENT_EMAIL = "layla.hassan@example.com";
const GUARDIAN_EMAIL = "guardian@example.com";

const SOLID_SOLUTION =
  "I built makeCounter(): a closure keeps `count` private and the returned function increments it.";
const SOLID_REASONING =
  "Closures capture the lexical scope at creation, so `count` survives between calls.";

function jsInput(overrides: Partial<GoalDiscoveryInput> = {}): GoalDiscoveryInput {
  return {
    targetDomain: { kind: "preset", presetId: "javascript" },
    desiredOutcome: "Build and deploy two practical JavaScript apps with tests and clean code",
    motivation: { kind: "career" },
    currentLevel: "developing",
    targetLevel: "build_independently",
    timeframe: { weeks: 24, preset: true },
    weeklyCommitment: { hoursPerWeek: 7, preset: true },
    constraints: [],
    ...overrides,
  };
}

let studentId = "";
let roadmap: Roadmap;
let firstUnitId: string;

function seedFor(who: string, key: string): Roadmap {
  const created = mockGoalEngine.createGoal(jsInput(), {
    studentId: who,
    idempotencyKey: `${key}-c`,
    diagnosisContext: null,
  });
  const locked = mockGoalEngine.lockGoal(created.goal.id, who, `${key}-l`);
  return mockRoadmapEngine.generateRoadmap(locked.id, who).roadmap;
}

beforeEach(async () => {
  mockExecutionEngine.__reset();
  mockRoadmapEngine.__reset();
  mockGoalEngine.__reset();
  await authService.logout().catch(() => undefined);
  const { session } = await authService.login({ email: STUDENT_EMAIL, password: PASSWORD });
  studentId = session.user.id;
  roadmap = seedFor(studentId, "svc-main");
  firstUnitId = [...roadmap.milestones].sort((a, b) => a.order - b.order)[0]!
    .learningUnits.sort((a, b) => a.order - b.order)[0]!.id;
});

describe("executionService — identity gate (§18)", () => {
  it("rejects anonymous access with 401", async () => {
    await authService.logout().catch(() => undefined);
    await expect(executionService.getExecutionView()).rejects.toMatchObject({
      executionCode: "unauthenticated",
      status: 401,
    });
    await expect(executionService.startLearningUnit(firstUnitId)).rejects.toBeInstanceOf(
      ExecutionApiError,
    );
  });

  it("rejects non-student roles with 403", async () => {
    await authService.logout().catch(() => undefined);
    await authService.login({ email: GUARDIAN_EMAIL, password: PASSWORD });
    await expect(executionService.getExecutionView()).rejects.toMatchObject({
      executionCode: "forbidden",
      status: 403,
    });
  });
});

describe("executionService — student lifecycle", () => {
  it("walks the full contract: view → start → submit → evaluate → passed", async () => {
    const view = await executionService.getExecutionView();
    expect(view?.currentUnit?.id).toBe(firstUnitId);

    const started = await executionService.startLearningUnit(firstUnitId);
    expect(started.status).toBe("in_progress");
    expect(started.studentId).toBe(studentId);

    const submitted = await executionService.submitEvidence(firstUnitId, {
      solution: SOLID_SOLUTION,
      reasoning: SOLID_REASONING,
    });
    expect(submitted.status).toBe("submitted");

    const evaluated = await executionService.evaluateExecution(firstUnitId);
    expect(evaluated.status).toBe("evaluated");
    expect(evaluated.result).toBe("passed");

    const after = await executionService.getExecutionView();
    expect(after?.unitStates[firstUnitId]).toBe("passed");
    expect(after?.currentUnit?.id).not.toBe(firstUnitId);
  });

  it("unit context resolves through the session — client sends only a unit id", async () => {
    const context = await executionService.getUnitContext(firstUnitId);
    expect(context.roadmap.id).toBe(roadmap.id);
    expect(context.unit.id).toBe(firstUnitId);
    expect(context.status).toBe("available");
  });

  it("full journey (§28): locked goal → roadmap → start → refresh → evidence → evaluation → next unit", async () => {
    // The roadmap already exists from a locked goal (beforeEach seed).
    const before = await executionService.getExecutionView();
    expect(before?.currentUnit?.id).toBe(firstUnitId);

    await executionService.startLearningUnit(firstUnitId);

    // Simulated refresh: a completely new view read reconstructs in_progress.
    const afterRefresh = await executionService.getExecutionView();
    expect(afterRefresh?.unitStates[firstUnitId]).toBe("in_progress");
    expect(afterRefresh?.currentUnit?.id).toBe(firstUnitId);

    await executionService.submitEvidence(firstUnitId, {
      solution: SOLID_SOLUTION,
      reasoning: SOLID_REASONING,
    });
    const evaluated = await executionService.evaluateExecution(firstUnitId);
    expect(evaluated.result).toBe("passed");

    // The next unit opens; the passed one stays passed.
    const after = await executionService.getExecutionView();
    expect(after?.unitStates[firstUnitId]).toBe("passed");
    const nextContext = await executionService.getUnitContext(
      after!.currentUnit!.id,
    );
    expect(nextContext.status).toBe("available");
    expect(nextContext.unit.id).not.toBe(firstUnitId);

    // The plan itself was never mutated by execution (§14).
    const untouched = mockRoadmapEngine.getRoadmap(roadmap.id, studentId);
    expect(untouched.updatedAt).toBe(roadmap.updatedAt);
    expect(untouched.status).toBe("active");
  });
});

describe("executionService — typed error funnel (§19)", () => {
  it("maps unknown units to execution_not_found 404", async () => {
    await expect(executionService.getUnitContext("unit_ghost")).rejects.toMatchObject({
      executionCode: "execution_not_found",
      status: 404,
    });
  });

  it("maps lifecycle violations to invalid_transition 409", async () => {
    await expect(executionService.evaluateExecution(firstUnitId)).rejects.toMatchObject({
      executionCode: "invalid_transition",
      status: 409,
    });
  });

  it("maps dependency violations to unit_unavailable 409", async () => {
    const lastUnit = [...roadmap.milestones].sort((a, b) => b.order - a.order)[0]!
      .learningUnits[0]!.id;
    await expect(executionService.startLearningUnit(lastUnit)).rejects.toMatchObject({
      executionCode: "unit_unavailable",
      status: 409,
    });
  });

  it("maps empty evidence to evidence_invalid 422", async () => {
    await executionService.startLearningUnit(firstUnitId);
    await expect(
      executionService.submitEvidence(firstUnitId, { solution: "", reasoning: "  " }),
    ).rejects.toMatchObject({ executionCode: "evidence_invalid", status: 422 });
  });

  it("never leaks internals — messages are stable domain codes", async () => {
    try {
      await executionService.getUnitContext("unit_ghost");
      expect.unreachable("should have thrown");
    } catch (error) {
      const typed = error as ExecutionApiError;
      expect(typed).toBeInstanceOf(ExecutionApiError);
      expect(typed.message).toBe("execution_not_found");
      expect(JSON.stringify(typed)).not.toContain("localStorage");
    }
  });
});

describe("executionService — idempotency & isolation (§16/§18)", () => {
  it("repeated starts through the service return the same execution", async () => {
    const first = await executionService.startLearningUnit(firstUnitId);
    const second = await executionService.startLearningUnit(firstUnitId);
    expect(second.id).toBe(first.id);
  });

  it("another student's execution state is invisible", async () => {
    await executionService.startLearningUnit(firstUnitId);

    // A second student with their OWN roadmap: same capability-based unit
    // ids, completely separate runtime state.
    seedFor("student_other", "svc-other");
    const otherView = mockExecutionEngine.getExecutionView("student_other");
    expect(otherView?.unitStates[firstUnitId]).toBe("available");

    // The session student still sees exactly their own state.
    const mine = await executionService.getExecutionView();
    expect(mine?.currentUnit?.id).toBe(firstUnitId);
    expect(mine?.unitStates[firstUnitId]).toBe("in_progress");
  });
});
