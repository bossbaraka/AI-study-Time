/**
 * Goal discovery service contract (§16/§21): ownership comes from the
 * authenticated session — never from client input — and every operation
 * funnels failures into GoalApiError with stable domain codes.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { authService } from "@/services/auth.service";
import { GoalApiError, goalDiscoveryService } from "@/services/goal-discovery.service";
import { mockGoalEngine } from "@/services/goals/mock-goal-engine";
import type { GoalDiscoveryInput } from "@/types/goal";

const PASSWORD = "securePass1";
const STUDENT_EMAIL = "layla.hassan@example.com";
const GUARDIAN_EMAIL = "guardian@example.com";

function strongInput(): GoalDiscoveryInput {
  return {
    targetDomain: { kind: "preset", presetId: "frontend" },
    desiredOutcome: "Build and deploy two practical frontend apps with tests and clean UI",
    motivation: { kind: "university" },
    currentLevel: "developing",
    targetLevel: "build_independently",
    timeframe: { weeks: 12, preset: true },
    weeklyCommitment: { hoursPerWeek: 7, preset: true },
    constraints: ["university_workload"],
  };
}

beforeEach(async () => {
  mockGoalEngine.__reset();
  await authService.logout().catch(() => undefined);
});

describe("goalDiscoveryService — identity gate", () => {
  it("rejects every operation for anonymous visitors", async () => {
    await expect(goalDiscoveryService.getActiveGoal()).rejects.toMatchObject({
      goalCode: "unauthenticated",
      status: 401,
    });
    await expect(goalDiscoveryService.createGoal(strongInput(), "k1")).rejects.toBeInstanceOf(
      GoalApiError,
    );
  });

  it("rejects non-student roles even when authenticated", async () => {
    await authService.login({ email: GUARDIAN_EMAIL, password: PASSWORD });
    await expect(goalDiscoveryService.getActiveGoal()).rejects.toMatchObject({
      goalCode: "forbidden",
      status: 403,
    });
  });
});

describe("goalDiscoveryService — student flow", () => {
  it("derives studentId from the session, not from client input", async () => {
    const { session } = await authService.login({ email: STUDENT_EMAIL, password: PASSWORD });
    const { goal } = await goalDiscoveryService.createGoal(strongInput(), "key-svc-1");
    expect(goal.studentId).toBe(session.user.id);
  });

  it("supports the full contract: create → get → update → validate → lock", async () => {
    await authService.login({ email: STUDENT_EMAIL, password: PASSWORD });

    const created = await goalDiscoveryService.createGoal(strongInput(), "key-svc-2");
    expect(created.goal.status).toBe("validated");

    const active = await goalDiscoveryService.getActiveGoal();
    expect(active?.id).toBe(created.goal.id);

    const updated = await goalDiscoveryService.updateGoal(created.goal.id, {
      desiredOutcome:
        "Build and deploy three practical frontend apps with automated tests and clean UI",
    });
    expect(updated.goal.version).toBe(created.goal.version + 1);

    const validation = await goalDiscoveryService.validateGoal(created.goal.id);
    expect(validation.valid).toBe(true);

    const locked = await goalDiscoveryService.lockGoal(created.goal.id, "key-lock-svc");
    expect(locked.status).toBe("locked");
    expect((await goalDiscoveryService.getActiveGoal())?.status).toBe("locked");
  });

  it("replays creation idempotently through the service seam", async () => {
    await authService.login({ email: STUDENT_EMAIL, password: PASSWORD });
    const first = await goalDiscoveryService.createGoal(strongInput(), "key-svc-dup");
    const second = await goalDiscoveryService.createGoal(strongInput(), "key-svc-dup");
    expect(second.goal.id).toBe(first.goal.id);
  });

  it("maps engine ownership failures to stable domain codes", async () => {
    await authService.login({ email: STUDENT_EMAIL, password: PASSWORD });
    await expect(goalDiscoveryService.getGoal("goal_missing")).rejects.toMatchObject({
      goalCode: "goal_not_found",
    });

    // A goal created under a different student id is unreachable.
    mockGoalEngine.createGoal(strongInput(), { studentId: "student_other", idempotencyKey: "k" });
    const foreign = mockGoalEngine.getActiveGoal("student_other");
    await expect(goalDiscoveryService.getGoal(foreign!.id)).rejects.toMatchObject({
      goalCode: "forbidden",
      status: 403,
    });
  });

  it("supports explicit revision of a locked goal", async () => {
    await authService.login({ email: STUDENT_EMAIL, password: PASSWORD });
    const { goal } = await goalDiscoveryService.createGoal(strongInput(), "key-svc-rev");
    await goalDiscoveryService.lockGoal(goal.id, "key-lock-rev");

    const revised = await goalDiscoveryService.reviseGoal(goal.id);
    expect(revised.goal.id).not.toBe(goal.id);
    expect(revised.goal.status).not.toBe("locked");
    expect((await goalDiscoveryService.getActiveGoal())?.id).toBe(revised.goal.id);
  });
});
