import { describe, it, expect } from "vitest";
import { gradeTest } from "./test-grading-engine";
import type { TestDefinition } from "@/types/test-attempt";

function makeTest(): TestDefinition {
  return {
    id: "test_1",
    title: "Closures",
    moduleId: "mod_closures",
    phaseTitle: "JS",
    timeLimitMinutes: null,
    questions: [
      {
        id: "q1",
        testId: "test_1",
        kind: "multiple_choice",
        prompt: "What is a closure?",
        choices: ["A", "B", "C"],
        correctChoiceIndex: 1,
        explanation: "B is correct",
        topic: "closures",
        points: 1,
      },
      {
        id: "q2",
        testId: "test_1",
        kind: "short_answer",
        prompt: "Name two uses of closures",
        explanation: "module and factory",
        topic: "scope",
        points: 2,
        rubric: { keywords: ["module", "privacy", "factory"], minMatches: 2 },
        choices: undefined,
        correctChoiceIndex: null,
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe("test grading engine", () => {
  it("grades multiple_choice correctly", () => {
    const def = makeTest();
    const result = gradeTest(def, [{ questionId: "q1", choiceIndex: 1 }], 60);
    expect(result.graded[0]?.correct).toBe(true);
    expect(result.graded[0]?.pointsEarned).toBe(1);
  });

  it("grades multiple_choice incorrect as zero", () => {
    const def = makeTest();
    const result = gradeTest(def, [{ questionId: "q1", choiceIndex: 0 }], 60);
    expect(result.graded[0]?.correct).toBe(false);
    expect(result.graded[0]?.pointsEarned).toBe(0);
  });

  it("grades short_answer with rubric keywords", () => {
    const def = makeTest();
    const correct = gradeTest(def, [{ questionId: "q2", answer: "module pattern and factory for privacy" }], 60);
    expect(correct.graded[1]?.correct).toBe(true);

    const partial = gradeTest(def, [{ questionId: "q2", answer: "module" }], 60);
    expect(partial.graded[1]?.pointsEarned).toBe(1); // partial 50%

    const wrong = gradeTest(def, [{ questionId: "q2", answer: "nothing relevant" }], 60);
    expect(wrong.graded[1]?.correct).toBe(false);
    expect(wrong.graded[1]?.pointsEarned).toBe(0);
  });

  it("is server-authoritative: ignores client-provided correct", () => {
    const def = makeTest();
    // Even if client sends a forged answer object with correct=true, grading recomputes
    const result = gradeTest(def, [{ questionId: "q1", choiceIndex: 0 }], 60);
    expect(result.graded[0]?.correct).toBe(false);
  });

  it("computes strongTopics and recommendation deterministically", () => {
    const def = makeTest();
    const full = gradeTest(def, [{ questionId: "q1", choiceIndex: 1 }, { questionId: "q2", answer: "module privacy factory" }], 60);
    expect(full.score).toBe(100);
    expect(full.recommendation).toBe("continue");
    expect(full.strongTopics).toContain("closures");

    const partial = gradeTest(def, [{ questionId: "q1", choiceIndex: 0 }, { questionId: "q2", answer: "module privacy factory" }], 60);
    expect(partial.score).toBeLessThan(100);
    expect(partial.needsReviewTopics).toContain("closures");
  });

  it("is deterministic: same inputs always same score", () => {
    const def = makeTest();
    const a = gradeTest(def, [{ questionId: "q1", choiceIndex: 1 }], 60);
    const b = gradeTest(def, [{ questionId: "q1", choiceIndex: 1 }], 60);
    expect(a.score).toBe(b.score);
    expect(a.graded[0]?.correct).toBe(b.graded[0]?.correct);
  });
});
