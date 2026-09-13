/**
 * Deterministic roadmap engine (§9–§20): generation pipeline, diagnosis
 * prioritisation, starting/target levels, dependencies, time budgeting,
 * quality gate, idempotency, versioning, ownership.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAssessmentEngine } from "@/services/assessment/mock-assessment-engine";
import { mockGoalEngine } from "@/services/goals/mock-goal-engine";
import { ENGINE_VERSION, mockRoadmapEngine, validateRoadmapStructure } from "@/services/roadmap/mock-roadmap-engine";
import { RoadmapGenerationError, RoadmapOwnershipError, RoadmapValidationError } from "@/services/roadmap/roadmap-errors";
import { InvalidRoadmapTransitionError } from "@/services/roadmap/roadmap-state-machine";
import { currentMilestone } from "@/features/roadmap/lib/current-milestone";
import type { AssessmentResult } from "@/types/assessment";
import type { GoalDiscoveryInput, LearningGoal } from "@/types/goal";
import type { Roadmap } from "@/types/roadmap";

const STUDENT = "student_01";
const OTHER = "student_02";

function jsInput(overrides: Partial<GoalDiscoveryInput> = {}): GoalDiscoveryInput {
  return {
    targetDomain: { kind: "preset", presetId: "javascript" },
    desiredOutcome: "Build and deploy two practical JavaScript apps with tests and clean code",
    motivation: { kind: "career" },
    currentLevel: "developing",
    targetLevel: "build_independently",
    timeframe: { weeks: 24, preset: true },
    weeklyCommitment: { hoursPerWeek: 7, preset: true },
    constraints: [],
    ...overrides,
  };
}

/** Creates AND locks a goal through the real goal engine. */
function lockedGoal(
  input: GoalDiscoveryInput = jsInput(),
  studentId: string = STUDENT,
): LearningGoal {
  const { goal } = mockGoalEngine.createGoal(input, {
    studentId,
    idempotencyKey: `key-${Math.random()}`,
  });
  return mockGoalEngine.lockGoal(goal.id, studentId, `lock-${Math.random()}`);
}

function diagnosis(overrides: Partial<AssessmentResult> = {}): AssessmentResult {
  return {
    sessionId: "session_diag",
    completedAt: new Date().toISOString(),
    questionsAnswered: 10,
    strengths: [],
    developingAreas: [],
    knowledgeGaps: [],
    recommendedStartingPoint: null,
    confidence: "medium",
    ...overrides,
  };
}

function lockedGoalWithDiagnosis(
  result: AssessmentResult,
  input: GoalDiscoveryInput = jsInput(),
): LearningGoal {
  const spy = vi
    .spyOn(mockAssessmentEngine, "getLatestCompletedResult")
    .mockReturnValue(result);
  const goal = lockedGoal(input);
  spy.mockRestore();
  return goal;
}

function lockedGoalWithDiagnosisInput(
  input: GoalDiscoveryInput,
  result: AssessmentResult,
): LearningGoal {
  return lockedGoalWithDiagnosis(result, input);
}

function milestoneTitles(roadmap: Roadmap): string[] {
  return [...roadmap.milestones].sort((a, b) => a.order - b.order).map((m) => m.capabilityId);
}

beforeEach(() => {
  mockRoadmapEngine.__reset();
  mockGoalEngine.__reset();
  mockAssessmentEngine.__reset();
});

describe("engine — generation from a locked goal", () => {
  it("generates an active roadmap whose first milestone is current", () => {
    const goal = lockedGoal();
    const { roadmap, created } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);

    expect(created).toBe(true);
    expect(roadmap.status).toBe("active");
    expect(roadmap.version).toBe(1);
    expect(roadmap.goalId).toBe(goal.id);
    expect(roadmap.studentId).toBe(STUDENT);
    expect(roadmap.milestones.length).toBeGreaterThan(1);
    // Exactly one current milestone — derived, never contradictory (§23).
    const inProgress = roadmap.milestones.filter((m) => m.status === "in_progress");
    expect(inProgress).toHaveLength(1);
    expect(inProgress[0]?.order).toBe(0);
    expect(currentMilestone(roadmap)?.id).toBe(inProgress[0]?.id);
  });

  it("fills the full milestone contract: outcome, units, checkpoint, alignment", () => {
    const goal = lockedGoal();
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    for (const milestone of roadmap.milestones) {
      expect(milestone.learningOutcome.trim().length).toBeGreaterThan(0);
      expect(milestone.goalAlignment).toContain("locked outcome");
      expect(milestone.estimatedHours).toBeGreaterThan(0);
      expect(milestone.checkpoint.type).toBeTruthy();
      expect(milestone.checkpoint.successSignal.trim().length).toBeGreaterThan(0);
      expect(milestone.learningUnits.length).toBeGreaterThan(0);
      for (const unit of milestone.learningUnits) {
        expect(unit.estimatedMinutes).toBeGreaterThanOrEqual(15);
        expect(unit.purpose.trim().length).toBeGreaterThan(0);
        expect(unit.expectedOutcome.trim().length).toBeGreaterThan(0);
        expect(unit.completionEvidence.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("records an honest generation context and duration mapping", () => {
    const goal = lockedGoal(jsInput({ timeframe: { weeks: 24, preset: true } }));
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    expect(roadmap.generationContext.engineVersion).toBe(ENGINE_VERSION);
    expect(roadmap.generationContext.goalVersion).toBe(goal.version);
    expect(roadmap.generationContext.availableHours).toBe(24 * 7);
    expect(roadmap.estimatedDuration).toEqual({ value: 6, unit: "months" });
    expect(roadmap.weeklyCommitment).toBe(7);

    const odd = lockedGoal(jsInput({ timeframe: { weeks: 6, preset: false } }));
    mockRoadmapEngine.__reset();
    const second = mockRoadmapEngine.generateRoadmap(odd.id, STUDENT).roadmap;
    expect(second.estimatedDuration).toEqual({ value: 6, unit: "weeks" });
  });

  it("refuses to generate without a locked goal", () => {
    const { goal } = mockGoalEngine.createGoal(
      jsInput({ desiredOutcome: "I want to learn more about JavaScript overall" }),
      { studentId: STUDENT, idempotencyKey: "key-unlocked" },
    );
    expect(goal.status).not.toBe("locked");
    expect(() => mockRoadmapEngine.generateRoadmap(goal.id, STUDENT)).toThrow(
      RoadmapGenerationError,
    );
    try {
      mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    } catch (error) {
      expect((error as RoadmapGenerationError).code).toBe("no_locked_goal");
    }
  });

  it("refuses unknown goal ids", () => {
    expect(() => mockRoadmapEngine.generateRoadmap("goal_missing", STUDENT)).toThrow(
      RoadmapGenerationError,
    );
  });
});

describe("engine — curriculum selection & dependencies (§12/§14)", () => {
  it("selects capabilities for the goal's domain only", () => {
    const goal = lockedGoal(jsInput({ targetDomain: { kind: "preset", presetId: "backend" } }));
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    for (const milestone of roadmap.milestones) {
      expect(milestone.capabilityId.startsWith("be.")).toBe(true);
    }
  });

  it("bounds depth by the target level", () => {
    const shallow = lockedGoal(jsInput({ targetLevel: "understand_fundamentals" }));
    const shallowRoadmap = mockRoadmapEngine.generateRoadmap(shallow.id, STUDENT).roadmap;
    // Only depth-0 JavaScript capabilities: functions + scope/closures.
    expect(milestoneTitles(shallowRoadmap)).toEqual(["js.functions", "js.scope_closures"]);

    mockRoadmapEngine.__reset();
    const deep = lockedGoal(
      jsInput({ targetLevel: "master_advanced", timeframe: { weeks: 52, preset: true } }),
    );
    const deepRoadmap = mockRoadmapEngine.generateRoadmap(deep.id, STUDENT).roadmap;
    expect(milestoneTitles(deepRoadmap)).toContain("js.capstone");
    expect(milestoneTitles(deepRoadmap)).toContain("js.testing");
  });

  it("orders every prerequisite before its dependent, with no cycles", () => {
    const goal = lockedGoal(
      jsInput({ targetLevel: "work_professionally", timeframe: { weeks: 52, preset: true } }),
    );
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    const orderByid = new Map(roadmap.milestones.map((m) => [m.id, m.order]));
    for (const milestone of roadmap.milestones) {
      for (const dependency of milestone.dependencies) {
        expect(orderByid.get(dependency)!).toBeLessThan(milestone.order);
      }
    }
    // js.async requires functions and closures material first.
    const titles = milestoneTitles(roadmap);
    expect(titles.indexOf("js.functions")).toBeLessThan(titles.indexOf("js.async"));
    expect(titles.indexOf("js.scope_closures")).toBeLessThan(titles.indexOf("js.async"));
  });

  it("builds a custom-domain path from the student's own criteria", () => {
    const goal = lockedGoal(
      jsInput({
        targetDomain: { kind: "custom", label: "Game development" },
        targetLevel: "build_independently",
        successCriteria: ["Ship one playable level", "Publish a devlog post"],
      }),
    );
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    const ids = milestoneTitles(roadmap);
    expect(ids).toContain("custom.foundations");
    expect(ids).toContain("custom.criterion_1");
    expect(ids).toContain("custom.criterion_2");
    const criterion = roadmap.milestones.find((m) => m.capabilityId === "custom.criterion_1");
    expect(criterion?.title).toContain("Ship one playable level");
    expect(roadmap.title).toContain("Game development");
  });
});

describe("engine — diagnosis-aware prioritisation (§13)", () => {
  it("expands hours for knowledge gaps and keeps them first-class", () => {
    // new_to_it keeps depth-0 material uncompressed, isolating the gap factor.
    const plain = lockedGoal(jsInput({ currentLevel: "new_to_it" }));
    const plainRoadmap = mockRoadmapEngine.generateRoadmap(plain.id, STUDENT).roadmap;
    mockRoadmapEngine.__reset();

    const spyGoal = jsInput({ currentLevel: "new_to_it" });
    const diagnosed = lockedGoalWithDiagnosisInput(
      spyGoal,
      diagnosis({
        knowledgeGaps: [{ topic: "closures", insight: "conceptual_gap", basedOnResponses: 2 }],
      }),
    );
    const diagnosedRoadmap = mockRoadmapEngine
      .generateRoadmap(diagnosed.id, STUDENT)
      .roadmap;

    const plainHours = (r: Roadmap) =>
      r.milestones.find((m) => m.capabilityId === "js.scope_closures")?.estimatedHours ?? 0;
    // base 8h × 1.25 gap factor = 10h (both budgets fit, scale = 1).
    expect(plainHours(plainRoadmap)).toBe(8);
    expect(plainHours(diagnosedRoadmap)).toBe(10);
  });

  it("compresses assessed strengths into review-first maintenance", () => {
    const goal = lockedGoalWithDiagnosis(
      diagnosis({
        strengths: [{ topic: "functions", insight: "strong_conceptual", basedOnResponses: 3 }],
      }),
    );
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    const functions = roadmap.milestones.find((m) => m.capabilityId === "js.functions");
    expect(functions?.maintenance).toBe(true);
    // base 6h × 0.5 strength factor = 3h.
    expect(functions?.estimatedHours).toBe(3);
    expect(functions?.learningUnits[0]?.type).toBe("review");
  });

  it("never lets a strength override a flagged gap on the same capability", () => {
    const goal = lockedGoalWithDiagnosis(
      diagnosis({
        strengths: [{ topic: "scope", insight: "strong_conceptual", basedOnResponses: 2 }],
        knowledgeGaps: [{ topic: "closures", insight: "conceptual_gap", basedOnResponses: 2 }],
      }),
    );
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    const closures = roadmap.milestones.find((m) => m.capabilityId === "js.scope_closures");
    expect(closures?.maintenance).toBe(false);
    expect(closures?.estimatedHours).toBe(10); // 8 × 1.25, not × 0.5
  });
});

describe("engine — starting level (§39)", () => {
  it("compresses material below an advanced starting point into maintenance", () => {
    const goal = lockedGoal(
      jsInput({
        currentLevel: "comfortable",
        targetLevel: "work_professionally",
        timeframe: { weeks: 52, preset: true },
      }),
    );
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    const functions = roadmap.milestones.find((m) => m.capabilityId === "js.functions");
    const async = roadmap.milestones.find((m) => m.capabilityId === "js.async");
    expect(functions?.maintenance).toBe(true); // depth 0 < start scale 2
    expect(async?.maintenance).toBe(true); // depth 1 < start scale 2
    expect(functions?.estimatedHours).toBe(3.5); // 6 × 0.6, rounded to 0.5
  });

  it("teaches everything fully when the student starts fresh", () => {
    const goal = lockedGoal(
      jsInput({ currentLevel: "new_to_it", targetLevel: "work_professionally", timeframe: { weeks: 52, preset: true } }),
    );
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    const functions = roadmap.milestones.find((m) => m.capabilityId === "js.functions");
    expect(functions?.maintenance).toBe(false);
    expect(functions?.estimatedHours).toBe(6);
  });
});

describe("engine — time budgeting (§15)", () => {
  it("reports 'fits' when the budget covers the natural path", () => {
    const goal = lockedGoal(); // 24w × 7h = 168 available, ~32 needed
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    expect(roadmap.timeFeasibility).toBe("fits");
    expect(roadmap.totalEstimatedHours).toBeLessThanOrEqual(
      roadmap.generationContext.availableHours,
    );
  });

  it("reports 'tight' honestly without rescaling", () => {
    // developing → build_independently: required 3.5+5+8+10 = 26.5h;
    // available 10w × 2h = 20h → 26.5 ≤ 20×1.35 → tight, no rescale.
    const goal = lockedGoal(
      jsInput({ timeframe: { weeks: 10, preset: false }, weeklyCommitment: { hoursPerWeek: 2, preset: false } }),
    );
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    expect(roadmap.generationContext.requiredHours).toBe(26.5);
    expect(roadmap.generationContext.availableHours).toBe(20);
    expect(roadmap.timeFeasibility).toBe("tight");
    expect(roadmap.totalEstimatedHours).toBe(26.5);
  });

  it("compresses and flags 'exceeds' instead of inventing 250h for 100h", () => {
    // available 6w × 2h = 12h vs required 26.5h → exceeds, scale ≈ 0.45 ≥ 0.4
    const goal = lockedGoal(
      jsInput({ timeframe: { weeks: 6, preset: false }, weeklyCommitment: { hoursPerWeek: 2, preset: false } }),
    );
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    expect(roadmap.timeFeasibility).toBe("exceeds");
    expect(roadmap.totalEstimatedHours).toBeLessThanOrEqual(
      roadmap.generationContext.availableHours + 1, // rounding tolerance
    );
  });

  it("throws infeasible_timeframe below the minimum viable budget", () => {
    // available 5w × 2h = 10h < minViableHours (12) — the goal engine
    // still locks it (its own heuristic passes), so the roadmap engine is
    // the honest gatekeeper here.
    const goal = lockedGoal(
      jsInput({ timeframe: { weeks: 5, preset: false }, weeklyCommitment: { hoursPerWeek: 2, preset: false } }),
    );
    expect(() => mockRoadmapEngine.generateRoadmap(goal.id, STUDENT)).toThrow(
      RoadmapGenerationError,
    );
    try {
      mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    } catch (error) {
      expect((error as RoadmapGenerationError).code).toBe("infeasible_timeframe");
    }
    // Nothing was persisted.
    expect(mockRoadmapEngine.getActiveRoadmap(STUDENT)).toBeNull();
  });

  it("throws when the weekly commitment leaves no viable budget", () => {
    const goal = lockedGoal(
      jsInput({ timeframe: { weeks: 4, preset: true }, weeklyCommitment: { hoursPerWeek: 2, preset: false } }),
    );
    // available 8h < minViableHours 12
    expect(() => mockRoadmapEngine.generateRoadmap(goal.id, STUDENT)).toThrow(
      /infeasible_timeframe/,
    );
  });
});

describe("engine — determinism & idempotency (§17/§19)", () => {
  it("produces identical roadmaps for identical inputs", () => {
    const goalA = lockedGoal(jsInput(), STUDENT);
    const a = mockRoadmapEngine.generateRoadmap(goalA.id, STUDENT).roadmap;

    const goalB = lockedGoal(jsInput(), OTHER);
    const b = mockRoadmapEngine.generateRoadmap(goalB.id, OTHER).roadmap;

    expect(milestoneTitles(a)).toEqual(milestoneTitles(b));
    expect(a.milestones.map((m) => m.estimatedHours)).toEqual(
      b.milestones.map((m) => m.estimatedHours),
    );
    expect(a.milestones.map((m) => m.learningUnits.map((u) => [u.type, u.estimatedMinutes]))).toEqual(
      b.milestones.map((m) => m.learningUnits.map((u) => [u.type, u.estimatedMinutes])),
    );
    expect(a.title).toBe(b.title);
  });

  it("replays generation idempotently — no duplicates", () => {
    const goal = lockedGoal();
    const first = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    const second = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    expect(second.created).toBe(false);
    expect(second.roadmap.id).toBe(first.roadmap.id);
    expect(second.roadmap.version).toBe(first.roadmap.version);
    expect(mockRoadmapEngine.getActiveRoadmap(STUDENT)?.id).toBe(first.roadmap.id);
  });
});

describe("engine — versioning & revision (§20)", () => {
  it("supersedes the old roadmap on goal revision and keeps history", () => {
    const goal = lockedGoal();
    const { roadmap: v1 } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    expect(v1.version).toBe(1);

    // Explicit revision through the goal engine, then re-lock.
    const { goal: revised } = mockGoalEngine.reviseGoal(goal.id, STUDENT);
    const relocked = mockGoalEngine.lockGoal(revised.id, STUDENT, "relock-key");

    const { roadmap: v2, created } = mockRoadmapEngine.generateRoadmap(relocked.id, STUDENT);
    expect(created).toBe(true);
    expect(v2.version).toBe(2);
    expect(v2.goalId).toBe(relocked.id);
    expect(v2.generationContext.goalVersion).toBe(relocked.version);

    // History is preserved, never mutated in place.
    const archived = mockRoadmapEngine.getRoadmap(v1.id, STUDENT);
    expect(archived.status).toBe("revised");
    expect(archived.title).toBe(v1.title);
    // The live roadmap is the new one.
    expect(mockRoadmapEngine.getActiveRoadmap(STUDENT)?.id).toBe(v2.id);
  });
});

describe("engine — pause / resume transitions", () => {
  it("pauses and resumes through the state machine", () => {
    const goal = lockedGoal();
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    const paused = mockRoadmapEngine.pauseRoadmap(roadmap.id, STUDENT);
    expect(paused.status).toBe("paused");
    const resumed = mockRoadmapEngine.resumeRoadmap(roadmap.id, STUDENT);
    expect(resumed.status).toBe("active");
  });

  it("rejects invalid transitions with a typed error", () => {
    const goal = lockedGoal();
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    mockRoadmapEngine.pauseRoadmap(roadmap.id, STUDENT);
    // paused → paused is a no-op self-transition; resume first, then re-pause
    // is fine, but pausing an already paused roadmap must throw.
    expect(() => mockRoadmapEngine.pauseRoadmap(roadmap.id, STUDENT)).toThrow(
      InvalidRoadmapTransitionError,
    );
  });
});

describe("engine — quality gate (§18)", () => {
  it("accepts a freshly generated roadmap", () => {
    const goal = lockedGoal();
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    expect(() => validateRoadmapStructure(roadmap)).not.toThrow();
  });

  it("rejects a milestone without a learning outcome", () => {
    const goal = lockedGoal();
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    const broken: Roadmap = {
      ...roadmap,
      milestones: roadmap.milestones.map((m, i) => (i === 0 ? { ...m, learningOutcome: " " } : m)),
    };
    expect(() => validateRoadmapStructure(broken)).toThrow(RoadmapValidationError);
  });

  it("rejects unknown and mis-ordered dependencies", () => {
    const goal = lockedGoal(
      jsInput({ targetLevel: "work_professionally", timeframe: { weeks: 52, preset: true } }),
    );
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);

    const unknown: Roadmap = {
      ...roadmap,
      milestones: roadmap.milestones.map((m, i) =>
        i === 0 ? { ...m, dependencies: ["ms_ghost"] } : m,
      ),
    };
    expect(() => validateRoadmapStructure(unknown)).toThrow(/unknown dependency/);

    const misordered: Roadmap = {
      ...roadmap,
      milestones: roadmap.milestones.map((m, i) =>
        i === 0
          ? { ...m, dependencies: [roadmap.milestones[roadmap.milestones.length - 1]!.id] }
          : m,
      ),
    };
    expect(() => validateRoadmapStructure(misordered)).toThrow(/not ordered before/);
  });

  it("rejects dependency cycles", () => {
    const goal = lockedGoal(
      jsInput({ targetLevel: "work_professionally", timeframe: { weeks: 52, preset: true } }),
    );
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    const [first, second] = [roadmap.milestones[0]!, roadmap.milestones[1]!];
    const cyclic: Roadmap = {
      ...roadmap,
      milestones: roadmap.milestones.map((m) => {
        if (m.id === first.id) return { ...m, dependencies: [second.id] };
        if (m.id === second.id) return { ...m, dependencies: [first.id] };
        return m;
      }),
    };
    expect(() => validateRoadmapStructure(cyclic)).toThrow(/cycle/);
  });
});

describe("engine — ownership (§28)", () => {
  it("never leaks another student's roadmap — foreign ids 404", () => {
    const goal = lockedGoal(jsInput(), OTHER);
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, OTHER);

    expect(() => mockRoadmapEngine.getRoadmap(roadmap.id, STUDENT)).toThrow(
      RoadmapOwnershipError,
    );
    try {
      mockRoadmapEngine.getRoadmap(roadmap.id, STUDENT);
    } catch (error) {
      expect((error as RoadmapOwnershipError).status).toBe(404);
      expect((error as RoadmapOwnershipError).code).toBe("roadmap_not_found");
    }
    expect(mockRoadmapEngine.getActiveRoadmap(STUDENT)).toBeNull();
  });

  it("rejects cross-student mutation", () => {
    const goal = lockedGoal(jsInput(), OTHER);
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, OTHER);
    expect(() => mockRoadmapEngine.pauseRoadmap(roadmap.id, STUDENT)).toThrow(
      RoadmapOwnershipError,
    );
  });

  it("rejects generation against another student's goal", () => {
    const goal = lockedGoal(jsInput(), OTHER);
    expect(() => mockRoadmapEngine.generateRoadmap(goal.id, STUDENT)).toThrow(/forbidden/);
  });
});

describe("engine — persistence", () => {
  it("survives a simulated refresh", () => {
    const goal = lockedGoal();
    const { roadmap } = mockRoadmapEngine.generateRoadmap(goal.id, STUDENT);
    const reloaded = mockRoadmapEngine.getActiveRoadmap(STUDENT);
    expect(reloaded?.id).toBe(roadmap.id);
    expect(reloaded?.milestones.length).toBe(roadmap.milestones.length);
  });
});
