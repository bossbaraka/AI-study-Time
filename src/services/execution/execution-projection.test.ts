/**
 * Execution projections (§12/§13): dependency-driven availability,
 * the ONE current unit, honest next-unit lookahead. Pure functions over
 * hand-built roadmap fixtures — no engine, no storage.
 */

import { describe, expect, it } from "vitest";
import {
  areDependenciesSatisfied,
  deriveUnitStates,
  isAllUnitsPassed,
  isMilestoneSatisfied,
  isUnitStartable,
  nextUnitAfter,
  orderedUnits,
  passedUnitIds,
  selectCurrentUnit,
} from "@/services/execution/execution-projection";
import type { LearningResult, LearningUnitExecution } from "@/types/execution";
import type { LearningUnit, Milestone, Roadmap } from "@/types/roadmap";

/* ------------------------------------------------------------------ */
/* Fixture: A(a1→a2) ← B(b1) ← C(c1)                                   */
/* ------------------------------------------------------------------ */

function makeUnit(milestoneId: string, id: string, order: number): LearningUnit {
  return {
    id,
    milestoneId,
    type: "learn",
    order,
    title: `Unit ${id}`,
    purpose: `purpose ${id}`,
    estimatedMinutes: 30,
    expectedOutcome: `outcome ${id}`,
    completionEvidence: `evidence ${id}`,
  };
}

function makeMilestone(
  roadmapId: string,
  id: string,
  order: number,
  unitIds: string[],
  dependencies: string[],
): Milestone {
  return {
    id,
    roadmapId,
    capabilityId: id,
    title: `Milestone ${id}`,
    description: `desc ${id}`,
    order,
    status: order === 0 ? "in_progress" : "pending",
    learningOutcome: `outcome ${id}`,
    estimatedHours: 2,
    dependencies,
    learningUnits: unitIds.map((unitId, index) => makeUnit(id, unitId, index)),
    checkpoint: {
      id: `cp_${id}`,
      milestoneId: id,
      type: "explain",
      title: `cp ${id}`,
      description: `cp desc ${id}`,
      successSignal: `signal ${id}`,
    },
    goalAlignment: `aligns ${id}`,
    maintenance: false,
  };
}

function makeRoadmap(): Roadmap {
  const milestones = [
    makeMilestone("rm_test", "A", 0, ["a1", "a2"], []),
    makeMilestone("rm_test", "B", 1, ["b1"], ["A"]),
    makeMilestone("rm_test", "C", 2, ["c1"], ["B"]),
  ];
  return {
    id: "rm_test",
    studentId: "s1",
    goalId: "g1",
    version: 1,
    status: "active",
    title: "Test path",
    description: "fixture",
    estimatedDuration: { value: 4, unit: "weeks" },
    weeklyCommitment: 5,
    totalEstimatedHours: 6,
    timeFeasibility: "fits",
    milestones,
    generationContext: {
      goalVersion: 1,
      engineVersion: "test",
      generationKey: "s1:g1:1:test",
      availableHours: 20,
      requiredHours: 6,
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function execution(unitId: string, result: LearningResult | null, statusOverride?: LearningUnitExecution["status"]): LearningUnitExecution {
  const base: LearningUnitExecution = {
    id: `ex_${unitId}`,
    studentId: "s1",
    roadmapId: "rm_test",
    milestoneId: unitId[0]!.toUpperCase(),
    learningUnitId: unitId,
    status: "evaluated",
  };
  if (statusOverride) return { ...base, status: statusOverride };
  if (result === null) return { ...base, status: "in_progress" };
  return { ...base, result };
}

const passed = (unitId: string) => execution(unitId, "passed");

describe("orderedUnits", () => {
  it("walks milestones in order and units inside them", () => {
    const ids = orderedUnits(makeRoadmap()).map((entry) => entry.unit.id);
    expect(ids).toEqual(["a1", "a2", "b1", "c1"]);
  });
});

describe("deriveUnitStates", () => {
  it("fresh roadmap: only the first unit is available", () => {
    const states = deriveUnitStates(makeRoadmap(), []);
    expect(states).toEqual({ a1: "available", a2: "blocked", b1: "blocked", c1: "blocked" });
  });

  it("mirrors execution records exactly — no invented states", () => {
    const states = deriveUnitStates(makeRoadmap(), [
      passed("a1"),
      execution("a2", null), // in_progress
    ]);
    expect(states.a1).toBe("passed");
    expect(states.a2).toBe("in_progress");
  });

  it("maps evaluated results onto needs_review / failed", () => {
    const states = deriveUnitStates(makeRoadmap(), [execution("a1", "needs_review")]);
    expect(states.a1).toBe("needs_review");
    const failedStates = deriveUnitStates(makeRoadmap(), [execution("a1", "failed")]);
    expect(failedStates.a1).toBe("failed");
  });
});

describe("dependency gates (§12)", () => {
  it("passing a1 opens a2 but keeps milestone B blocked", () => {
    const states = deriveUnitStates(makeRoadmap(), [passed("a1")]);
    expect(states.a2).toBe("available");
    expect(states.b1).toBe("blocked");
  });

  it("a milestone is satisfied only when ALL its units passed", () => {
    const roadmap = makeRoadmap();
    const milestoneA = roadmap.milestones[0]!;
    expect(isMilestoneSatisfied(milestoneA, passedUnitIds([passed("a1")]))).toBe(false);
    expect(isMilestoneSatisfied(milestoneA, passedUnitIds([passed("a1"), passed("a2")]))).toBe(
      true,
    );
  });

  it("prerequisite passed → dependent unit available", () => {
    const states = deriveUnitStates(makeRoadmap(), [passed("a1"), passed("a2")]);
    expect(states.b1).toBe("available");
    expect(areDependenciesSatisfied(makeRoadmap().milestones[1]!, makeRoadmap(), passedUnitIds([passed("a1"), passed("a2")]))).toBe(true);
  });

  it("prerequisite failed → dependents remain unavailable", () => {
    const states = deriveUnitStates(makeRoadmap(), [execution("a1", "failed")]);
    expect(states.a2).toBe("blocked");
    expect(states.b1).toBe("blocked");
    expect(states.c1).toBe("blocked");
  });

  it("prerequisite needs_review → dependents remain unavailable (no silent advance)", () => {
    const states = deriveUnitStates(makeRoadmap(), [passed("a1"), execution("a2", "needs_review")]);
    expect(states.b1).toBe("blocked");
  });

  it("isUnitStartable agrees with the derived availability", () => {
    const roadmap = makeRoadmap();
    expect(isUnitStartable(roadmap, [], "a1")).toBe(true);
    expect(isUnitStartable(roadmap, [], "b1")).toBe(false);
    expect(isUnitStartable(roadmap, [passed("a1")], "a1")).toBe(false); // already passed
    expect(isUnitStartable(roadmap, [passed("a1"), passed("a2")], "b1")).toBe(true);
  });

  it("treats a dangling dependency id as satisfied (generation validated the graph)", () => {
    const roadmap = makeRoadmap();
    roadmap.milestones[1]!.dependencies = ["ghost"];
    const states = deriveUnitStates(roadmap, [passed("a1"), passed("a2")]);
    expect(states.b1).toBe("available");
  });
});

describe("selectCurrentUnit — exactly one focus (§21)", () => {
  it("is the first unit on a fresh roadmap", () => {
    const current = selectCurrentUnit(makeRoadmap(), []);
    expect(current?.unit.id).toBe("a1");
  });

  it("an in-flight unit stays current", () => {
    const current = selectCurrentUnit(makeRoadmap(), [execution("a1", null)]);
    expect(current?.unit.id).toBe("a1");
  });

  it("needs_review and failed units remain relevant — the student stays put", () => {
    expect(selectCurrentUnit(makeRoadmap(), [execution("a1", "needs_review")])?.unit.id).toBe(
      "a1",
    );
    expect(selectCurrentUnit(makeRoadmap(), [execution("a1", "failed")])?.unit.id).toBe("a1");
  });

  it("advances in roadmap order as units pass", () => {
    expect(selectCurrentUnit(makeRoadmap(), [passed("a1")])?.unit.id).toBe("a2");
    expect(selectCurrentUnit(makeRoadmap(), [passed("a1"), passed("a2")])?.unit.id).toBe("b1");
  });

  it("is null only when every unit passed — completion is not decided here", () => {
    const all = [passed("a1"), passed("a2"), passed("b1"), passed("c1")];
    expect(selectCurrentUnit(makeRoadmap(), all)).toBeNull();
    expect(isAllUnitsPassed(makeRoadmap(), all)).toBe(true);
    expect(isAllUnitsPassed(makeRoadmap(), [passed("a1"), passed("a2"), passed("b1")])).toBe(
      false,
    );
  });
});

describe("nextUnitAfter — honest lookahead", () => {
  it("projects the pass without mutating anything", () => {
    const roadmap = makeRoadmap();
    const executions: LearningUnitExecution[] = [];
    expect(nextUnitAfter(roadmap, executions, "a1")?.unit.id).toBe("a2");
    // Nothing was mutated by the lookahead.
    expect(deriveUnitStates(roadmap, executions).a1).toBe("available");
  });

  it("crosses milestone boundaries once the projection satisfies dependencies", () => {
    expect(nextUnitAfter(makeRoadmap(), [passed("a1")], "a2")?.unit.id).toBe("b1");
  });

  it("is null after the final unit passes", () => {
    const rest = [passed("a1"), passed("a2"), passed("b1")];
    expect(nextUnitAfter(makeRoadmap(), rest, "c1")).toBeNull();
  });
});
