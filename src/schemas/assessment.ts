/**
 * STEP 4 answer validation — one small Zod schema per question type.
 * Messages are translation keys resolved by `resolveZodMessage` (shared
 * with the auth schemas); raw Zod errors never reach the UI.
 */

import { z } from "zod";
import type {
  AssessmentQuestion,
  AssessmentQuestionType,
  AssessmentResponse,
} from "@/types/assessment";

export const multipleChoiceAnswerSchema = z.object({
  optionId: z.string().min(1, "assessment.errors.optionRequired"),
});

/** Short answer: deliberately unconstrained beyond "not empty" (§11). */
export const shortAnswerSchema = z.object({
  answer: z.string().trim().min(1, "assessment.errors.answerRequired"),
});

/** Scenario: a chosen direction is required; reasoning is welcomed, not forced. */
export const scenarioAnswerSchema = z.object({
  optionId: z.string().min(1, "assessment.errors.optionRequired"),
  reasoning: z.string().trim().optional(),
});

export const problemSolvingAnswerSchema = z.object({
  answer: z.string().trim().min(1, "assessment.errors.answerRequired"),
});

export type MultipleChoiceAnswerValues = z.infer<typeof multipleChoiceAnswerSchema>;
export type ShortAnswerValues = z.infer<typeof shortAnswerSchema>;
export type ScenarioAnswerValues = z.infer<typeof scenarioAnswerSchema>;
export type ProblemSolvingAnswerValues = z.infer<typeof problemSolvingAnswerSchema>;

/** Union of every answer-form shape (RHF resolver target). */
export const answerValuesSchema = z.union([
  multipleChoiceAnswerSchema,
  shortAnswerSchema,
  scenarioAnswerSchema,
  problemSolvingAnswerSchema,
]);

export type AnswerFormValues =
  | MultipleChoiceAnswerValues
  | ShortAnswerValues
  | ScenarioAnswerValues
  | ProblemSolvingAnswerValues;

export function answerSchemaFor(
  type: AssessmentQuestionType,
):
  | typeof multipleChoiceAnswerSchema
  | typeof shortAnswerSchema
  | typeof scenarioAnswerSchema
  | typeof problemSolvingAnswerSchema {
  switch (type) {
    case "multiple_choice":
      return multipleChoiceAnswerSchema;
    case "short_answer":
      return shortAnswerSchema;
    case "scenario":
      return scenarioAnswerSchema;
    case "problem_solving":
      return problemSolvingAnswerSchema;
  }
}

/**
 * Form values → typed response for the service boundary.
 * The mapping lives here (not in components) so every question type
 * produces exactly one well-formed `AssessmentResponse` variant.
 */
export function toAssessmentResponse(
  question: AssessmentQuestion,
  values: AnswerFormValues,
): AssessmentResponse {
  switch (question.type) {
    case "multiple_choice": {
      const { optionId } = multipleChoiceAnswerSchema.parse(values);
      return { type: "multiple_choice", questionId: question.id, optionId };
    }
    case "short_answer": {
      const { answer } = shortAnswerSchema.parse(values);
      return { type: "short_answer", questionId: question.id, answer };
    }
    case "scenario": {
      const { optionId, reasoning } = scenarioAnswerSchema.parse(values);
      return {
        type: "scenario",
        questionId: question.id,
        optionId,
        ...(reasoning && reasoning.length > 0 ? { reasoning } : {}),
      };
    }
    case "problem_solving": {
      const { answer } = problemSolvingAnswerSchema.parse(values);
      return { type: "problem_solving", questionId: question.id, answer };
    }
  }
}
