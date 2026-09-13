/**
 * Answer validation schemas — every rule maps to a translation key,
 * never a raw Zod message.
 */

import { describe, expect, it } from "vitest";
import {
  answerSchemaFor,
  multipleChoiceAnswerSchema,
  problemSolvingAnswerSchema,
  scenarioAnswerSchema,
  shortAnswerSchema,
  toAssessmentResponse,
} from "@/schemas/assessment";
import type { AssessmentQuestion } from "@/types/assessment";

function question(overrides: Partial<AssessmentQuestion>): AssessmentQuestion {
  return {
    id: "q1",
    type: "multiple_choice",
    prompt: "Prompt",
    topic: "functions",
    difficulty: "foundational",
    estimatedSeconds: 60,
    ...overrides,
  };
}

describe("assessment answer schemas", () => {
  it("rejects an empty multiple-choice answer with a keyed message", () => {
    const result = multipleChoiceAnswerSchema.safeParse({ optionId: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("assessment.errors.optionRequired");
    }
  });

  it("accepts a selected option", () => {
    expect(multipleChoiceAnswerSchema.safeParse({ optionId: "a" }).success).toBe(true);
  });

  it("rejects an empty short answer", () => {
    expect(shortAnswerSchema.safeParse({ answer: "" }).success).toBe(false);
    expect(shortAnswerSchema.safeParse({ answer: "   " }).success).toBe(false);
  });

  it("accepts and trims a short answer without over-constraining it", () => {
    const result = shortAnswerSchema.safeParse({ answer: "  it depends on scope  " });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.answer).toBe("it depends on scope");
  });

  it("requires a scenario direction but keeps reasoning optional", () => {
    expect(scenarioAnswerSchema.safeParse({ optionId: "" }).success).toBe(false);
    expect(scenarioAnswerSchema.safeParse({ optionId: "a" }).success).toBe(true);
    expect(
      scenarioAnswerSchema.safeParse({ optionId: "a", reasoning: "because shadowing" }).success,
    ).toBe(true);
  });

  it("rejects an empty problem-solving answer", () => {
    expect(problemSolvingAnswerSchema.safeParse({ answer: "" }).success).toBe(false);
  });

  it("maps each question type to its schema", () => {
    expect(answerSchemaFor("multiple_choice")).toBe(multipleChoiceAnswerSchema);
    expect(answerSchemaFor("short_answer")).toBe(shortAnswerSchema);
    expect(answerSchemaFor("scenario")).toBe(scenarioAnswerSchema);
    expect(answerSchemaFor("problem_solving")).toBe(problemSolvingAnswerSchema);
  });
});

describe("toAssessmentResponse", () => {
  it("builds a typed multiple_choice response", () => {
    const response = toAssessmentResponse(
      question({ id: "mc1", type: "multiple_choice" }),
      { optionId: "b" },
    );
    expect(response).toEqual({ type: "multiple_choice", questionId: "mc1", optionId: "b" });
  });

  it("builds a typed short_answer response", () => {
    const response = toAssessmentResponse(
      question({ id: "sa1", type: "short_answer" }),
      { answer: "a closure captures scope" },
    );
    expect(response).toEqual({
      type: "short_answer",
      questionId: "sa1",
      answer: "a closure captures scope",
    });
  });

  it("omits empty scenario reasoning from the payload", () => {
    const response = toAssessmentResponse(
      question({ id: "sc1", type: "scenario" }),
      { optionId: "a", reasoning: "   " },
    );
    expect(response).toEqual({ type: "scenario", questionId: "sc1", optionId: "a" });
  });

  it("builds a typed problem_solving response", () => {
    const response = toAssessmentResponse(
      question({ id: "ps1", type: "problem_solving" }),
      { answer: "check the captured reference" },
    );
    expect(response).toEqual({
      type: "problem_solving",
      questionId: "ps1",
      answer: "check the captured reference",
    });
  });
});
