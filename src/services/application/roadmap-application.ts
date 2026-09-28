/**
 * Roadmap application service — the server-side coordinator for roadmap routes.
 *
 * Route → **this** → roadmap engine (planner) → `RoadmapStore` port → Prisma.
 *
 * The planner is the engine's, not this file's. Nothing here selects
 * capabilities, budgets hours or orders milestones; generation takes a locked
 * goal id and the engine does the rest, including the structure gate that
 * runs before anything is persisted.
 *
 * **Server-only.**
 */

import { roadmapEngine } from "@/services/engines.server";
import type { Roadmap, RoadmapGenerationResult } from "@/types/roadmap";

export const roadmapApplication = {
  /** The student's live roadmap, or null when none has been generated. */
  getActiveRoadmap(studentId: string): Promise<Roadmap | null> {
    return roadmapEngine.getActiveRoadmap(studentId);
  },

  getRoadmap(roadmapId: string, studentId: string): Promise<Roadmap> {
    return roadmapEngine.getRoadmap(roadmapId, studentId);
  },

  /**
   * Generates (or replays) the plan for a locked goal.
   *
   * Idempotent on `studentId:goalId:goalVersion:engineVersion`. Phase 2 moved
   * that check from an in-memory scan into a unique constraint on
   * `generationKey`, so two concurrent generations cannot both succeed.
   */
  generateRoadmap(goalId: string, studentId: string): Promise<RoadmapGenerationResult> {
    return roadmapEngine.generateRoadmap(goalId, studentId);
  },

  pauseRoadmap(roadmapId: string, studentId: string): Promise<Roadmap> {
    return roadmapEngine.pauseRoadmap(roadmapId, studentId);
  },

  resumeRoadmap(roadmapId: string, studentId: string): Promise<Roadmap> {
    return roadmapEngine.resumeRoadmap(roadmapId, studentId);
  },
};
