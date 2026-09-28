/**
 * Server-side request schemas for the roadmap API.
 *
 * Roadmap generation takes ONE input: the locked goal to plan for. There is
 * deliberately nothing else — no milestone list, no hours override, no
 * capability selection. The planner derives the plan from the locked goal and
 * the diagnosis; a client that could pass plan parameters could bypass the
 * feasibility check that is the planner's whole purpose.
 */

import { z } from "zod";

export const generateRoadmapSchema = z.object({
  goalId: z.string().trim().min(1).max(64),
});

export const roadmapIdParamSchema = z.string().trim().min(1).max(64);

export type GenerateRoadmapInput = z.infer<typeof generateRoadmapSchema>;
