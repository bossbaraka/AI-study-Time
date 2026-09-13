/**
 * Development evaluator (§9/§22): deterministic, honest results.
 * No fake mastery — a thin attempt is needs_review or failed, never
 * passed; the same evidence always yields the same result.
 */

import { describe, expect, it } from "vitest";
import {
  developmentEvaluator,
  EVIDENCE_POLICY,
} from "@/services/execution/development-evaluator";
import type { LearningEvidence } from "@/types/execution";

function evidence(solution: string, reasoning: string): LearningEvidence {
  return { kind: "text", solution, reasoning, submittedAt: new Date().toISOString() };
}

const SOLID_SOLUTION =
  "I wrote a counter closure: makeCounter keeps `count` in the enclosing scope and returns an increment function.";
const SOLID_REASONING =
  "The inner function keeps access to `count` because closures capture the lexical scope at creation time.";

describe("developmentEvaluator", () => {
  it("passes evidence with both sections substantive", () => {
    expect(developmentEvaluator.evaluate(evidence(SOLID_SOLUTION, SOLID_REASONING))).toBe("passed");
  });

  it("returns needs_review for a real but thin attempt", () => {
    // Above the attempt floor, below the sufficiency thresholds.
    const thinSolution = "I used a closure here."; // 23 chars
    expect(developmentEvaluator.evaluate(evidence(thinSolution, SOLID_REASONING))).toBe(
      "needs_review",
    );
    expect(
      developmentEvaluator.evaluate(evidence(SOLID_SOLUTION, "It just works.")),
    ).toBe("needs_review");
  });

  it("returns failed when a section is below the attempt floor", () => {
    expect(developmentEvaluator.evaluate(evidence("idk", SOLID_REASONING))).toBe("failed");
    expect(developmentEvaluator.evaluate(evidence(SOLID_SOLUTION, "yes"))).toBe("failed");
    expect(developmentEvaluator.evaluate(evidence("", ""))).toBe("failed");
  });

  it("trims whitespace before judging", () => {
    const padded = evidence(`   ${"x".repeat(EVIDENCE_POLICY.attemptFloorChars - 1)}   `, "  ok?  ");
    expect(developmentEvaluator.evaluate(padded)).toBe("failed");
  });

  it("is deterministic: identical evidence → identical result", () => {
    const first = developmentEvaluator.evaluate(evidence(SOLID_SOLUTION, SOLID_REASONING));
    const second = developmentEvaluator.evaluate(evidence(SOLID_SOLUTION, SOLID_REASONING));
    expect(first).toBe(second);
  });

  it("sits exactly on policy thresholds as documented", () => {
    const exactSolution = "a".repeat(EVIDENCE_POLICY.sufficientSolutionChars);
    const exactReasoning = "b".repeat(EVIDENCE_POLICY.sufficientReasoningChars);
    expect(developmentEvaluator.evaluate(evidence(exactSolution, exactReasoning))).toBe("passed");
    const justBelow = evidence(
      "a".repeat(EVIDENCE_POLICY.sufficientSolutionChars - 1),
      exactReasoning,
    );
    expect(developmentEvaluator.evaluate(justBelow)).toBe("needs_review");
  });
});
