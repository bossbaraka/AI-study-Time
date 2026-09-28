/**
 * Server-side request schemas for the goal API.
 *
 * `schemas/goal.ts` validates the FORM (translation-key messages, chip
 * groups as strings). These validate what actually crosses the network.
 * The route handlers never trust a payload shape, and every string is
 * length-bounded — the same discipline as `assessment-api.ts`.
 *
 * Note what is deliberately absent: there is no `status` field anywhere in
 * these schemas. A client cannot write a goal's state; it can only request a
 * named transition (`lock`, `revise`) that the goal state machine may or may
 * not permit. `PATCH { status: "completed" }` is not representable.
 */

import { z } from "zod";
import {
  CONSTRAINT_KINDS,
  CURRENT_LEVELS,
  MOTIVATION_KINDS,
  TARGET_LEVELS,
} from "@/types/goal";

/* Bounds mirror `schemas/goal.ts` so the server rejects exactly what the
   form would have, and nothing that the form would have accepted. */

const goalDomainSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("preset"), presetId: z.enum([
    "javascript",
    "frontend",
    "backend",
    "software_engineering",
    "ai",
    "data_science",
    "cybersecurity",
    "english",
    "mathematics",
  ]) }),
  z.object({ kind: z.literal("custom"), label: z.string().trim().min(1).max(60) }),
]);

const goalMotivationSchema = z.object({
  kind: z.enum(MOTIVATION_KINDS),
  note: z.string().trim().max(240).optional(),
});

const goalTimeframeSchema = z.object({
  weeks: z.number().int().min(1).max(104),
  preset: z.boolean(),
});

const goalCommitmentSchema = z.object({
  hoursPerWeek: z.number().min(1).max(80),
  preset: z.boolean(),
});

/** The full creation payload. Every field required — the form enforces that. */
export const goalDiscoveryInputSchema = z.object({
  targetDomain: goalDomainSchema,
  desiredOutcome: z.string().trim().min(1).max(400),
  motivation: goalMotivationSchema,
  currentLevel: z.enum(CURRENT_LEVELS),
  targetLevel: z.enum(TARGET_LEVELS),
  timeframe: goalTimeframeSchema,
  weeklyCommitment: goalCommitmentSchema,
  constraints: z.array(z.enum(CONSTRAINT_KINDS)).max(20),
  successCriteria: z.array(z.string().trim().min(1).max(160)).max(20).optional(),
});

/**
 * A refinement patch: every field optional, because a patch says "change
 * these". An empty object is rejected — a PATCH that changes nothing is a
 * client bug, and accepting it would produce a no-op version bump.
 */
export const goalRefinePatchSchema = goalDiscoveryInputSchema
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "at least one field is required",
  });

export const createGoalSchema = z.object({
  input: goalDiscoveryInputSchema,
  /** Client-generated replay key. Bounded so it cannot be used as a DoS vector. */
  idempotencyKey: z.string().trim().min(1).max(128),
});

export const lockGoalSchema = z.object({
  idempotencyKey: z.string().trim().min(1).max(128),
});

/** A path segment that is an id, not a query. Bounded for the same reason. */
export const goalIdParamSchema = z.string().trim().min(1).max(64);

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type GoalRefinePatchInput = z.infer<typeof goalRefinePatchSchema>;
