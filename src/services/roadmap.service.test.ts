/**
 * Roadmap service contract (§27/§28): identity from the session, typed
 * error funnel, idempotent generation, ownership isolation.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { authService } from "@/services/auth.service";
import { goalDiscoveryService } from "@/services/goal-discovery.service";
import { mockGoalEngine } from "@/services/goals/mock-goal-engine";
import { RoadmapApiError, roadmapService } from "@/services/roadmap.service";
import { mockRoadmapEngine } from "@/services/roadmap/mock-roadmap-engine";
import type { GoalDiscoveryInput } from "@/types/goal";

const PASSWORD = "securePass1";
const STUDENT_EMAIL = "layla.hassan@example.com";
const GUARDIAN_EMAIL = "guardian@example.com";

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

async function loginStudent() {
  const { session } = await authService.login({ email: STUDENT_EMAIL, password: PASSWORD });
  return session;
}

async function lockedGoalId(): Promise<string> {
  const { goal } = await goalDiscoveryService.createGoal(jsInput(), "key-rs");
  const locked = await goalDiscoveryService.lockGoal(goal.id, "lock-rs");
  return locked.id;
}

beforeEach(async () => {
  mockRoadmapEngine.__reset();
  mockGoalEngine.__reset();
  await authService.logout().catch(() => undefined);
});

describe("roadmapService — identity gate", () => {
  it("rejects anonymous access", async () => {
    await expect(roadmapService.getActiveRoadmap()).rejects.toMatchObject({
      roadmapCode: "unauthenticated",
      status: 401,
    });
    await expect(roadmapService.generateRoadmap("goal_x")).rejects.toBeInstanceOf(RoadmapApiError);
  });

  it("rejects non-student roles", async () => {
    await authService.login({ email: GUARDIAN_EMAIL, password: PASSWORD });
    await expect(roadmapService.getActiveRoadmap()).rejects.toMatchObject({
      roadmapCode: "forbidden",
      status: 403,
    });
  });
});

describe("roadmapService — student flow", () => {
  it("generates from the locked goal with session-derived ownership", async () => {
    const session = await loginStudent();
    const goalId = await lockedGoalId();

    const { roadmap, created } = await roadmapService.generateRoadmap(goalId);
    expect(created).toBe(true);
    expect(roadmap.studentId).toBe(session.user.id);
    expect(roadmap.goalId).toBe(goalId);
    expect(roadmap.status).toBe("active");

    const active = await roadmapService.getActiveRoadmap();
    expect(active?.id).toBe(roadmap.id);
    const fetched = await roadmapService.getRoadmap(roadmap.id);
    expect(fetched.id).toBe(roadmap.id);
  });

  it("replays generation idempotently through the service seam", async () => {
    await loginStudent();
    const goalId = await lockedGoalId();
    const first = await roadmapService.generateRoadmap(goalId);
    const second = await roadmapService.generateRoadmap(goalId);
    expect(second.created).toBe(false);
    expect(second.roadmap.id).toBe(first.roadmap.id);
  });

  it("maps generation problems to stable domain codes", async () => {
    await loginStudent();
    // A goal that never validated cannot be locked → cannot generate.
    const { goal } = await goalDiscoveryService.createGoal(
      jsInput({ desiredOutcome: "I want to learn more about JavaScript overall" }),
      "key-rs-bad",
    );
    await expect(roadmapService.generateRoadmap(goal.id)).rejects.toMatchObject({
      roadmapCode: "no_locked_goal",
    });
  });

  it("pauses and resumes through the service", async () => {
    await loginStudent();
    const goalId = await lockedGoalId();
    const { roadmap } = await roadmapService.generateRoadmap(goalId);
    const paused = await roadmapService.pauseRoadmap(roadmap.id);
    expect(paused.status).toBe("paused");
    const resumed = await roadmapService.resumeRoadmap(roadmap.id);
    expect(resumed.status).toBe("active");
  });

  it("hides other students' roadmaps behind 404s", async () => {
    await loginStudent();
    // A roadmap generated for a different student id, straight in the engine.
    const foreignGoal = mockGoalEngine.createGoal(jsInput(), {
      studentId: "student_other",
      idempotencyKey: "key-foreign",
    }).goal;
    const foreignLocked = mockGoalEngine.lockGoal(foreignGoal.id, "student_other", "lock-foreign");
    const foreign = mockRoadmapEngine.generateRoadmap(foreignLocked.id, "student_other").roadmap;

    await expect(roadmapService.getRoadmap(foreign.id)).rejects.toMatchObject({
      roadmapCode: "roadmap_not_found",
      status: 404,
    });
    await expect(roadmapService.pauseRoadmap(foreign.id)).rejects.toMatchObject({
      roadmapCode: "roadmap_not_found",
    });
    expect(await roadmapService.getActiveRoadmap()).toBeNull();
  });
});
