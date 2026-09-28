/**
 * Active-goal projection (§6): ONE authoritative active goal. Dashboard
 * surfaces see the student's real locked goal; the seeded mock is only a
 * fallback. Nothing is destructively rewritten.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { authService } from "@/services/auth.service";
import {
  getAuthoritativeDashboardGoal,
  projectLockedGoal,
} from "@/services/goals/active-goal-projection";
import { goalDiscoveryService } from "@/services/goal-discovery.service";
import { goalService } from "@/services/journey.service";
import { mockGoalEngine } from "@/services/engines";
import type { GoalDiscoveryInput } from "@/types/goal";

const PASSWORD = "securePass1";
const STUDENT_EMAIL = "layla.hassan@example.com";
const GUARDIAN_EMAIL = "guardian@example.com";

const OUTCOME = "Build and deploy two practical JavaScript apps with tests and clean code";

function jsInput(): GoalDiscoveryInput {
  return {
    targetDomain: { kind: "preset", presetId: "javascript" },
    desiredOutcome: OUTCOME,
    motivation: { kind: "career", note: "Switch into a junior dev role" },
    currentLevel: "developing",
    targetLevel: "build_independently",
    timeframe: { weeks: 12, preset: true },
    weeklyCommitment: { hoursPerWeek: 7, preset: true },
    constraints: [],
  };
}

async function lockRealGoal(): Promise<string> {
  const { goal } = await goalDiscoveryService.createGoal(jsInput(), "key-proj");
  const locked = await goalDiscoveryService.lockGoal(goal.id, "lock-proj");
  return locked.id;
}

beforeEach(async () => {
  await mockGoalEngine.__reset();
  await authService.logout().catch(() => undefined);
});

describe("projectLockedGoal — pure projection", () => {
  it("maps a locked goal into the legacy dashboard shape honestly", async () => {
    await authService.login({ email: STUDENT_EMAIL, password: PASSWORD });
    const goalId = await lockRealGoal();
    const locked = await mockGoalEngine.getGoal(goalId, (await authService.getSessionState()).session!.user.id);

    const projected = projectLockedGoal(locked);
    expect(projected.id).toBe(locked.id);
    expect(projected.title).toBe(OUTCOME);
    expect(projected.description).toBe("Switch into a junior dev role");
    expect(projected.locked).toBe(true);
    expect(projected.lockedAt).toBe(locked.lockedAt);
    expect(projected.weeklyCommitmentHours).toBe(7);
    // targetDate = lockedAt + 12 weeks
    const expected = new Date(new Date(locked.lockedAt!).getTime() + 12 * 7 * 86400000);
    expect(new Date(projected.targetDate!).getTime()).toBe(expected.getTime());
    // No execution engine exists yet — progress must not be invented.
    expect(projected.overallProgress).toBe(0);
  });
});

describe("getAuthoritativeDashboardGoal — session authority", () => {
  it("returns null for anonymous visitors and non-students", async () => {
    expect(await getAuthoritativeDashboardGoal()).toBeNull();
    await authService.login({ email: GUARDIAN_EMAIL, password: PASSWORD });
    expect(await getAuthoritativeDashboardGoal()).toBeNull();
  });

  it("returns null when the student has no locked goal", async () => {
    await authService.login({ email: STUDENT_EMAIL, password: PASSWORD });
    expect(await getAuthoritativeDashboardGoal()).toBeNull();
  });

  it("returns the projection once the goal is locked", async () => {
    await authService.login({ email: STUDENT_EMAIL, password: PASSWORD });
    const goalId = await lockRealGoal();
    const authoritative = await getAuthoritativeDashboardGoal();
    expect(authoritative?.id).toBe(goalId);
    expect(authoritative?.locked).toBe(true);
  });
});

describe("goalService.getCurrent — dashboard integration", () => {
  it("serves the locked goal to dashboard surfaces", async () => {
    await authService.login({ email: STUDENT_EMAIL, password: PASSWORD });
    const goalId = await lockRealGoal();
    const current = await goalService.getCurrent();
    expect(current.id).toBe(goalId);
    expect(current.title).toBe(OUTCOME);
  });

  it("falls back to the seeded mock when no goal is locked", async () => {
    const current = await goalService.getCurrent();
    expect(current.id).toBe("goal_01");
    expect(current.title).toBe("Become a Full-Stack Developer");
  });
});
