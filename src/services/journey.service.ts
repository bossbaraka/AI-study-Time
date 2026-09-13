/**
 * Journey domain services: student, goal, roadmap, daily plan, mission.
 * Every function is an async contract — swap mockRequest for httpRequest
 * when the REST/Supabase backend lands.
 */

import { getAuthoritativeDashboardGoal } from "@/services/goals/active-goal-projection";
import { clone, mockRequest } from "@/lib/api/client";
import { db } from "@/services/mock-db";
import type {
  DailyPlan,
  Goal,
  Mission,
  MissionState,
  Roadmap,
  StudentProfile,
} from "@/types/domain";
import type { DailyStepState } from "@/types/domain";
import type { DailyLoopStep } from "@/constants/journey";

export const studentService = {
  getCurrent(signal?: AbortSignal): Promise<StudentProfile> {
    return mockRequest(() => clone(db.student), signal);
  },
};

export const goalService = {
  getCurrent(signal?: AbortSignal): Promise<Goal> {
    // One authoritative active goal (§6): the student's locked Phase-5
    // goal when present; the seeded mock only as a fallback.
    return mockRequest(async () => {
      const authoritative = await getAuthoritativeDashboardGoal();
      return authoritative ?? clone(db.goal);
    }, signal);
  },

  requestChange(reason: string, signal?: AbortSignal): Promise<{ received: boolean }> {
    return mockRequest(() => {
      void reason; // Sent to mentor review in the real backend.
      return { received: true };
    }, signal);
  },
};

export const roadmapService = {
  getCurrent(signal?: AbortSignal): Promise<Roadmap> {
    return mockRequest(() => clone(db.roadmap), signal);
  },
};

export const dailyPlanService = {
  getToday(signal?: AbortSignal): Promise<DailyPlan> {
    return mockRequest(() => {
      db.dailyPlan = { ...db.dailyPlan, mission: clone(db.mission) };
      return clone(db.dailyPlan);
    }, signal);
  },

  setStepState(step: DailyLoopStep, state: DailyStepState, signal?: AbortSignal): Promise<DailyPlan> {
    return mockRequest(() => {
      db.dailyPlan.steps = db.dailyPlan.steps.map((s) =>
        s.step === step ? { ...s, state } : s,
      );
      return clone(db.dailyPlan);
    }, signal);
  },
};

export const missionService = {
  getCurrent(signal?: AbortSignal): Promise<Mission> {
    return mockRequest(() => clone(db.mission), signal);
  },

  setState(state: MissionState, signal?: AbortSignal): Promise<Mission> {
    return mockRequest(() => {
      db.mission = { ...db.mission, state };
      return clone(db.mission);
    }, signal);
  },

  /** Persist elapsed focus time when pausing/completing. */
  tick(elapsedSeconds: number, signal?: AbortSignal): Promise<Mission> {
    return mockRequest(() => {
      db.mission = { ...db.mission, elapsedSeconds };
      return clone(db.mission);
    }, signal);
  },

  complete(signal?: AbortSignal): Promise<Mission> {
    return mockRequest(() => {
      db.mission = { ...db.mission, state: "completed" };
      db.dailyPlan.steps = db.dailyPlan.steps.map((s) =>
        s.step === "learn" ? { ...s, state: "done" as DailyStepState } : s,
      );
      return clone(db.mission);
    }, signal);
  },
};
