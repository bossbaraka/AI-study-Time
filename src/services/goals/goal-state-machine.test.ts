/**
 * Goal state machine (§5): the only authority on status transitions.
 * Invalid edges must be rejected loudly — a locked goal can never slide
 * back to draft, and components can never mutate status directly.
 */

import { describe, expect, it } from "vitest";
import {
  InvalidGoalTransitionError,
  assertTransition,
  canTransition,
  isEditable,
  isTerminal,
} from "@/services/goals/goal-state-machine";
import type { GoalStatus } from "@/types/goal";

describe("goal state machine — primary Phase 5 chain", () => {
  it("allows draft → discovered → refining → validated → locked", () => {
    expect(canTransition("draft", "discovered")).toBe(true);
    expect(canTransition("discovered", "refining")).toBe(true);
    expect(canTransition("refining", "validated")).toBe(true);
    expect(canTransition("validated", "locked")).toBe(true);
  });

  it("allows the refinement loop and validated → refining (edit after review)", () => {
    expect(canTransition("refining", "refining")).toBe(false); // no-op is not a transition
    expect(canTransition("validated", "refining")).toBe(true);
    expect(canTransition("discovered", "validated")).toBe(true);
  });

  it("allows explicit revision out of locked/active", () => {
    expect(canTransition("locked", "revised")).toBe(true);
    expect(canTransition("active", "revised")).toBe(true);
    expect(canTransition("locked", "active")).toBe(true);
  });
});

describe("goal state machine — invalid transitions", () => {
  const invalid: [GoalStatus, GoalStatus][] = [
    ["draft", "locked"],
    ["draft", "validated"],
    ["discovered", "locked"],
    ["refining", "locked"],
    ["validated", "draft"],
    ["locked", "draft"],
    ["locked", "refining"],
    ["locked", "validated"],
    ["achieved", "active"],
    ["abandoned", "draft"],
    ["revised", "draft"],
  ];

  it.each(invalid)("rejects %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(InvalidGoalTransitionError);
  });

  it("rejects every self-transition as a no-op", () => {
    expect(canTransition("locked", "locked")).toBe(false);
    expect(canTransition("draft", "draft")).toBe(false);
  });

  it("carries from/to on the thrown error", () => {
    try {
      assertTransition("locked", "draft");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidGoalTransitionError);
      expect((error as InvalidGoalTransitionError).from).toBe("locked");
      expect((error as InvalidGoalTransitionError).to).toBe("draft");
    }
  });
});

describe("goal state machine — status predicates", () => {
  it("treats pre-lock statuses as editable", () => {
    expect(isEditable("draft")).toBe(true);
    expect(isEditable("discovered")).toBe(true);
    expect(isEditable("refining")).toBe(true);
    expect(isEditable("validated")).toBe(true);
  });

  it("treats locked and later statuses as immutable", () => {
    expect(isEditable("locked")).toBe(false);
    expect(isEditable("active")).toBe(false);
    expect(isEditable("achieved")).toBe(false);
    expect(isEditable("revised")).toBe(false);
  });

  it("marks achieved/abandoned/revised as terminal", () => {
    expect(isTerminal("achieved")).toBe(true);
    expect(isTerminal("abandoned")).toBe(true);
    expect(isTerminal("revised")).toBe(true);
    expect(isTerminal("locked")).toBe(false);
  });
});
