/**
 * Roadmap state machine (§8): DRAFT → ACTIVE → COMPLETED, ACTIVE ⇄ PAUSED,
 * ACTIVE → REVISED → (new draft). Invalid transitions must throw typed.
 */

import { describe, expect, it } from "vitest";
import {
  InvalidRoadmapTransitionError,
  assertTransition,
  canTransition,
  isTerminal,
} from "@/services/roadmap/roadmap-state-machine";
import type { RoadmapStatus } from "@/types/roadmap";

describe("roadmap state machine — valid transitions", () => {
  it("allows the minimum flow draft → active → completed", () => {
    expect(canTransition("draft", "active")).toBe(true);
    expect(canTransition("active", "completed")).toBe(true);
  });

  it("allows pause and resume", () => {
    expect(canTransition("active", "paused")).toBe(true);
    expect(canTransition("paused", "active")).toBe(true);
  });

  it("allows explicit revision and abandonment from live states", () => {
    expect(canTransition("active", "revised")).toBe(true);
    expect(canTransition("active", "abandoned")).toBe(true);
    expect(canTransition("draft", "abandoned")).toBe(true);
    expect(canTransition("paused", "abandoned")).toBe(true);
  });
});

describe("roadmap state machine — invalid transitions", () => {
  const invalid: [RoadmapStatus, RoadmapStatus][] = [
    ["completed", "active"],
    ["abandoned", "active"],
    ["revised", "active"],
    ["revised", "draft"],
    ["completed", "paused"],
    ["draft", "completed"],
    ["draft", "paused"],
    ["paused", "completed"],
    ["abandoned", "draft"],
  ];

  it.each(invalid)("rejects %s → %s", (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(InvalidRoadmapTransitionError);
  });

  it("rejects self-transitions as no-ops", () => {
    expect(canTransition("active", "active")).toBe(false);
    expect(canTransition("draft", "draft")).toBe(false);
  });

  it("carries from/to on the typed error", () => {
    try {
      assertTransition("completed", "active");
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidRoadmapTransitionError);
      expect((error as InvalidRoadmapTransitionError).from).toBe("completed");
      expect((error as InvalidRoadmapTransitionError).to).toBe("active");
    }
  });

  it("marks completed/abandoned/revised as terminal", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("abandoned")).toBe(true);
    expect(isTerminal("revised")).toBe(true);
    expect(isTerminal("active")).toBe(false);
  });
});
