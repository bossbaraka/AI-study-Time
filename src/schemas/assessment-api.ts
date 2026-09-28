/**
 * Server-side request schemas for the assessment API.
 *
 * The client-side `schemas/assessment.ts` validates FORM values before
 * submission. These validate what actually crosses the network — the
 * route handlers never trust a payload shape, and every string is
 * length-bounded so an oversized body cannot reach the question
 * generator (or an LLM prompt) unbounded.
 */

import { z } from "zod";

const EDUCATIONAL_STAGES = [
  "elementary",
  "middle",
  "high_school",
  "university",
  "professional",
] as const;

/**
 * The diagnostic profile. `targetSubject` is interpolated into the
 * question-generation prompt, so it is trimmed and hard-capped — this is
 * the prompt-injection / oversized-input boundary for that path.
 */
export const assessmentProfileSchema = z.object({
  targetSubject: z.string().trim().min(1).max(120),
  age: z.number().int().min(6).max(90),
  stage: z.enum(EDUCATIONAL_STAGES),
});

export const createSessionSchema = z.object({
  profile: assessmentProfileSchema.optional(),
});

/** A student's answer. Carries NO correctness verdict — the server decides. */
export const assessmentResponseSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("multiple_choice"),
    questionId: z.string().trim().min(1).max(64),
    optionId: z.string().trim().min(1).max(16),
  }),
  z.object({
    type: z.literal("short_answer"),
    questionId: z.string().trim().min(1).max(64),
    answer: z.string().trim().min(1).max(4000),
  }),
  z.object({
    type: z.literal("scenario"),
    questionId: z.string().trim().min(1).max(64),
    optionId: z.string().trim().min(1).max(16),
    reasoning: z.string().trim().max(4000).optional(),
  }),
  z.object({
    type: z.literal("problem_solving"),
    questionId: z.string().trim().min(1).max(64),
    answer: z.string().trim().min(1).max(4000),
  }),
]);

export const submitAnswerSchema = z.object({
  sessionId: z.string().trim().min(1).max(64),
  response: assessmentResponseSchema,
  submissionId: z.string().trim().min(1).max(128),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
