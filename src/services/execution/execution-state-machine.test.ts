/**
 * Execution state machine (§11): every legal edge, every forbidden edge,
 * terminal semantics, and the result-aware retry edge.
 */

import { describe, expect, it } from "vitest";
import {
  assertTransition,
  canTransition,
  InvalidExecutionTransitionError,
  isTerminal,
  type ExecutionSnapshot,
} from "@/services/execution/execution-state-machine";
import type { LearningResult, LearningUnitExecutionStatus } from "@/types/execution";

const snapshot = (
  status: LearningUnitExecutionStatus,
  result?: LearningResult,
): ExecutionSnapshot => (result ? { status, result } : { status });

describe("execution state machine — legal transitions", () => {
  it("allows the happy path: available → in_progress → submitted → evaluated", () => {
    expect(canTransition(snapshot("available"), "in_progress")).toBe(true);
    expect(canTransition(snapshot("in_progress"), "submitted")).toBe(true);
    expect(canTransition(snapshot("submitted"), "evaluated")).toBe(true);
  });

  it("allows the explicit retry edge from needs_review", () => {
    expect(canTransition(snapshot("evaluated", "needs_review"), "in_progress")).toBe(true);
  });

  it("allows the explicit retry edge from failed", () => {
    expect(canTransition(snapshot("evaluated", "failed"), "in_progress")).toBe(true);
  });
});

describe("execution state machine — forbidden transitions (§11)", () => {
  const forbidden: Array<[ExecutionSnapshot, LearningUnitExecutionStatus]> = [
    // A passed unit never reopens and never re-submits.
    [snapshot("evaluated", "passed"), "in_progress"],
    [snapshot("evaluated", "passed"), "submitted"],
    // Skipping the lifecycle is impossible.
    [snapshot("available"), "submitted"],
    [snapshot("available"), "evaluated"],
    // An evaluation is final for its evidence — no silent resubmission.
    [snapshot("evaluated", "needs_review"), "submitted"],
    [snapshot("evaluated", "failed"), "submitted"],
    // Backwards edges.
    [snapshot("in_progress"), "available"],
    [snapshot("submitted"), "in_progress"],
  ];

  it.each(forbidden)("rejects %j → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
  });

  it("treats same-status no-ops as non-transitions", () => {
    expect(canTransition(snapshot("in_progress"), "in_progress")).toBe(false);
    expect(canTransition(snapshot("available"), "available")).toBe(false);
  });

  it("assertTransition throws a typed error carrying from/to/result", () => {
    try {
      assertTransition(snapshot("evaluated", "passed"), "in_progress");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidExecutionTransitionError);
      const typed = error as InvalidExecutionTransitionError;
      expect(typed.from).toBe("evaluated");
      expect(typed.to).toBe("in_progress");
      expect(typed.result).toBe("passed");
    }
  });
});

describe("execution state machine — terminal semantics", () => {
  it("evaluated+passed is the only terminal state", () => {
    expect(isTerminal(snapshot("evaluated", "passed"))).toBe(true);
    expect(isTerminal(snapshot("evaluated", "needs_review"))).toBe(false);
    expect(isTerminal(snapshot("evaluated", "failed"))).toBe(false);
    expect(isTerminal(snapshot("submitted"))).toBe(false);
    expect(isTerminal(snapshot("in_progress"))).toBe(false);
  });
});
