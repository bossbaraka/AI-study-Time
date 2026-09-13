/**
 * Development evidence evaluator (Phase 7, §9) — deterministic & honest.
 *
 * WHAT IT IS:
 * A structural completeness check. It verifies that the student produced
 * both required evidence parts (a solution AND their own reasoning) with
 * substantive content. It is deterministic: same evidence ⇒ same result.
 *
 * WHAT IT IS NOT:
 * It does NOT understand free-form text and does NOT judge correctness.
 * No fake mastery, no confidence scores, no "AI analyzed" claims (§22).
 * When the evidence is a real attempt but too thin to be conclusive, the
 * honest answer is `needs_review` — never a false `passed`.
 *
 * A future AI/human evaluator implements the same `EvidenceEvaluator`
 * interface behind the engine; nothing else changes.
 */

import type { LearningEvidence, LearningResult } from "@/types/execution";

/** Seam for future evaluators (AI or human) — same contract. */
export interface EvidenceEvaluator {
  readonly name: string;
  evaluate(evidence: LearningEvidence): LearningResult;
}

/**
 * Centralized evaluation policy (mirrors the roadmap engine's
 * ALLOCATION_POLICY convention — tunable in one place).
 */
export const EVIDENCE_POLICY = {
  /** Below this a section is not a real attempt → failed. */
  attemptFloorChars: 12,
  /** Both sections at/above these ⇒ evidence contract fulfilled → passed. */
  sufficientSolutionChars: 40,
  sufficientReasoningChars: 30,
} as const;

export const developmentEvaluator: EvidenceEvaluator = {
  name: "development-evaluator/1.0.0",

  evaluate(evidence: LearningEvidence): LearningResult {
    const solution = evidence.solution.trim();
    const reasoning = evidence.reasoning.trim();

    // A near-empty section demonstrates nothing — honest failure, and the
    // student keeps the retry edge (failed is not terminal).
    if (
      solution.length < EVIDENCE_POLICY.attemptFloorChars ||
      reasoning.length < EVIDENCE_POLICY.attemptFloorChars
    ) {
      return "failed";
    }

    // Both parts substantive ⇒ the evidence contract is demonstrably met.
    if (
      solution.length >= EVIDENCE_POLICY.sufficientSolutionChars &&
      reasoning.length >= EVIDENCE_POLICY.sufficientReasoningChars
    ) {
      return "passed";
    }

    // A real attempt that falls short of the contract: insufficient to
    // confidently establish the outcome — review beats a false pass (§9).
    return "needs_review";
  },
};
