/**
 * Mock goal engine (§9–§14): validation rules, qualitative quality,
 * refinement guidance, lock protection and idempotency. Exercised
 * directly — the engine has zero React dependencies.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockAssessmentEngine } from "@/services/assessment/mock-assessment-engine";
import { mockGoalEngine } from "@/services/goals/mock-goal-engine";
import type { GoalDiscoveryInput, GoalIssueCode } from "@/types/goal";

const STUDENT = "student_01";

function strongInput(overrides: Partial<GoalDiscoveryInput> = {}): GoalDiscoveryInput {
  return {
    targetDomain: { kind: "preset", presetId: "backend" },
    desiredOutcome:
      "Build and deploy two practical backend apps with a database and authentication",
    motivation: { kind: "career" },
    currentLevel: "developing",
    targetLevel: "build_independently",
    timeframe: { weeks: 12, preset: true },
    weeklyCommitment: { hoursPerWeek: 7, preset: true },
    constraints: [],
    ...overrides,
  };
}

function create(input: GoalDiscoveryInput, key = "key-create") {
  return mockGoalEngine.createGoal(input, { studentId: STUDENT, idempotencyKey: key });
}

function issueCodes(codes: { code: GoalIssueCode }[]): GoalIssueCode[] {
  return codes.map((issue) => issue.code);
}

beforeEach(() => {
  mockGoalEngine.__reset();
  mockAssessmentEngine.__reset();
});

describe("engine — goal creation", () => {
  it("creates a goal with engine-drafted criteria when none are provided", () => {
    const { goal, validation } = create(strongInput());
    expect(goal.status).toBe("validated");
    expect(goal.successCriteria.length).toBeGreaterThan(0);
    expect(validation.valid).toBe(true);
    expect(goal.version).toBe(1);
    expect(goal.lockedAt).toBeNull();
  });

  it("keeps student-provided criteria untouched", () => {
    const { goal } = create(strongInput({ successCriteria: ["Ship app one with tests"] }));
    expect(goal.successCriteria).toEqual(["Ship app one with tests"]);
  });

  it("trims the desired outcome but never rewrites it", () => {
    const outcome = "  Build and deploy two practical backend apps for my portfolio  ";
    const { goal } = create(strongInput({ desiredOutcome: outcome }));
    expect(goal.desiredOutcome).toBe(outcome.trim());
  });

  it("attaches the latest diagnosis engine-side (client never supplies it)", () => {
    const diagnosis = { id: "result_01", studentId: STUDENT };
    const spy = vi
      .spyOn(mockAssessmentEngine, "getLatestCompletedResult")
      .mockReturnValue(diagnosis as never);
    const { goal } = create(strongInput());
    expect(goal.diagnosisContext).toEqual(diagnosis);
    spy.mockRestore();
  });

  it("is idempotent: replaying the same key returns the original goal", () => {
    const first = create(strongInput(), "key-dup");
    const second = create(strongInput(), "key-dup");
    expect(second.goal.id).toBe(first.goal.id);
    expect(second.goal.version).toBe(first.goal.version);
  });

  it("creates a separate goal for a different idempotency key", () => {
    const first = create(strongInput(), "key-a");
    const second = create(strongInput(), "key-b");
    expect(second.goal.id).not.toBe(first.goal.id);
    expect(mockGoalEngine.getActiveGoal(STUDENT)?.id).toBe(second.goal.id);
  });

  it("returns null from getActiveGoal when the student has no goal", () => {
    expect(mockGoalEngine.getActiveGoal(STUDENT)).toBeNull();
  });
});

describe("engine — validation rules (§10)", () => {
  it("flags 'I want to learn more' as vague, not specific", () => {
    const { validation } = create(
      strongInput({ desiredOutcome: "I want to learn more about coding and improve myself" }),
    );
    expect(validation.valid).toBe(false);
    expect(issueCodes(validation.issues)).toContain("outcome_vague");
  });

  it("flags 'Learn Python' as topic-only", () => {
    const { validation } = create(
      strongInput({
        targetDomain: { kind: "custom", label: "Python" },
        desiredOutcome: "Learn Python",
      }),
    );
    expect(validation.valid).toBe(false);
    expect(issueCodes(validation.issues)).toContain("topic_only");
  });

  it("flags 'Master everything about AI in 2 weeks' as unrealistic", () => {
    const { validation } = create(
      strongInput({
        targetDomain: { kind: "preset", presetId: "ai" },
        desiredOutcome: "Master everything about AI in 2 weeks",
        currentLevel: "new_to_it",
        targetLevel: "master_advanced",
        timeframe: { weeks: 2, preset: false },
      }),
    );
    expect(validation.valid).toBe(false);
    expect(issueCodes(validation.issues)).toContain("unrealistic_timeframe");
  });

  it("accepts 'Build and deploy two practical apps within 3 months' as strong", () => {
    const { validation } = create(
      strongInput({
        desiredOutcome: "Build and deploy two practical Python apps within 3 months",
        targetDomain: { kind: "custom", label: "Python" },
        timeframe: { weeks: 12, preset: true },
        weeklyCommitment: { hoursPerWeek: 10, preset: true },
      }),
    );
    expect(validation.valid).toBe(true);
    expect(validation.issues.filter((i) => i.severity === "error")).toHaveLength(0);
    expect(validation.overall).toBe("ready");
  });

  it("flags a missing outcome and a custom domain without a name", () => {
    const { validation } = create(
      strongInput({ desiredOutcome: "", targetDomain: { kind: "custom", label: "  " } }),
    );
    const codes = issueCodes(validation.issues);
    expect(codes).toContain("outcome_missing");
    expect(codes).toContain("custom_domain_missing");
  });

  it("flags missing timeframe and missing commitment", () => {
    const { validation } = create(
      strongInput({
        timeframe: { weeks: 0, preset: false },
        weeklyCommitment: { hoursPerWeek: 0, preset: false },
      }),
    );
    const codes = issueCodes(validation.issues);
    expect(codes).toContain("timeframe_missing");
    expect(codes).toContain("commitment_missing");
  });

  it("warns (without blocking) when the timeline is aggressive", () => {
    const { validation } = create(
      strongInput({
        currentLevel: "new_to_it",
        targetLevel: "work_professionally",
        timeframe: { weeks: 24, preset: true },
        weeklyCommitment: { hoursPerWeek: 4, preset: true },
      }),
    );
    // needed = 20 + 3×60 = 200h; available = 96h (< 150 warning, > 80 error)
    expect(validation.valid).toBe(true);
    expect(issueCodes(validation.issues)).toContain("timeline_aggressive");
    expect(validation.issues.find((i) => i.code === "timeline_aggressive")?.severity).toBe(
      "warning",
    );
  });

  it("warns when a long-distance goal runs on 2 hours/week", () => {
    const { validation } = create(
      strongInput({
        currentLevel: "new_to_it",
        targetLevel: "work_professionally",
        timeframe: { weeks: 52, preset: true },
        weeklyCommitment: { hoursPerWeek: 2, preset: true },
      }),
    );
    expect(issueCodes(validation.issues)).toContain("commitment_insufficient");
  });

  it("warns when the outcome cannot be checked off", () => {
    const { validation } = create(
      strongInput({
        desiredOutcome: "Feel confident enough to apply for junior frontend roles and keep growing steadily",
      }),
    );
    expect(issueCodes(validation.issues)).toContain("not_measurable");
    expect(validation.suggestions.map((s) => s.code)).toContain("measurable_outcome");
  });

  it("produces qualitative verdicts only — never fabricated numbers", () => {
    const { validation } = create(strongInput());
    expect(validation.quality.length).toBe(8);
    for (const entry of validation.quality) {
      expect(["strong", "developing", "weak"]).toContain(entry.verdict);
    }
    expect(JSON.stringify(validation)).not.toMatch(/%|score|\/100/);
  });
});

describe("engine — refinement guidance (§11)", () => {
  it("suggests a concrete outcome with a structured payload, never auto-applies", () => {
    const { goal, validation } = create(
      strongInput({ desiredOutcome: "I want to get better at backend development overall" }),
    );
    const suggestion = validation.suggestions.find((s) => s.code === "concrete_outcome");
    expect(suggestion).toBeDefined();
    expect(suggestion?.payload.outcome?.length).toBeGreaterThan(0);
    // The student's own words are untouched until they choose otherwise.
    expect(goal.desiredOutcome).toBe(
      "I want to get better at backend development overall",
    );
  });

  it("suggests a realistic window when the timeframe is unrealistic", () => {
    const { validation } = create(
      strongInput({
        currentLevel: "new_to_it",
        targetLevel: "master_advanced",
        timeframe: { weeks: 4, preset: true },
        weeklyCommitment: { hoursPerWeek: 7, preset: true },
      }),
    );
    const suggestion = validation.suggestions.find((s) => s.code === "realistic_window");
    expect(suggestion?.payload.weeks).toBeGreaterThan(4);
  });

  it("applies a student patch, bumps the version and re-validates", () => {
    const { goal } = create(
      strongInput({ desiredOutcome: "I want to learn more about backend development" }),
      "key-refine",
    );
    expect(goal.status).toBe("refining");

    const refined = mockGoalEngine.updateGoal(goal.id, STUDENT, {
      desiredOutcome: "Build and deploy two practical backend apps with a database and tests",
    });
    expect(refined.goal.version).toBe(goal.version + 1);
    expect(refined.validation.valid).toBe(true);
    expect(refined.goal.status).toBe("validated");
  });

  it("flags criteria_missing and drafts criteria when the student clears them", () => {
    const { goal } = create(strongInput(), "key-criteria");
    const refined = mockGoalEngine.updateGoal(goal.id, STUDENT, { successCriteria: [] });
    expect(issueCodes(refined.validation.issues)).toContain("criteria_missing");
    const suggestion = refined.validation.suggestions.find((s) => s.code === "draft_criteria");
    expect((suggestion?.payload.criteria?.length ?? 0)).toBeGreaterThan(0);
  });

  it("rejects updates to a locked goal", () => {
    const { goal } = create(strongInput(), "key-lock-update");
    mockGoalEngine.lockGoal(goal.id, STUDENT, "key-lock-1");
    expect(() =>
      mockGoalEngine.updateGoal(goal.id, STUDENT, { desiredOutcome: "Something else entirely" }),
    ).toThrow(/invalid_transition/);
  });
});

describe("engine — locking (§13/§14)", () => {
  it("locks a validated goal and records lockedAt", () => {
    const { goal } = create(strongInput(), "key-lock");
    const locked = mockGoalEngine.lockGoal(goal.id, STUDENT, "key-lock-1");
    expect(locked.status).toBe("locked");
    expect(locked.lockedAt).not.toBeNull();
    expect(mockGoalEngine.getGoal(goal.id, STUDENT).status).toBe("locked");
  });

  it("refuses to lock a goal with open errors — it stays unlocked", () => {
    const { goal } = create(
      strongInput({ desiredOutcome: "I want to learn more about coding in general" }),
      "key-bad",
    );
    expect(goal.status).toBe("refining");
    expect(() => mockGoalEngine.lockGoal(goal.id, STUDENT, "key-lock-bad")).toThrow(
      /validation_failed/,
    );
    const after = mockGoalEngine.getGoal(goal.id, STUDENT);
    expect(after.status).toBe("refining");
    expect(after.lockedAt).toBeNull();
  });

  it("is idempotent: a repeated lock never duplicates the transition", () => {
    const { goal } = create(strongInput(), "key-idem");
    const first = mockGoalEngine.lockGoal(goal.id, STUDENT, "key-lock-1");
    const second = mockGoalEngine.lockGoal(goal.id, STUDENT, "key-lock-2");
    expect(second.id).toBe(first.id);
    expect(second.version).toBe(first.version);
    expect(second.lockedAt).toBe(first.lockedAt);
  });

  it("survives a simulated refresh: locked state comes back from storage", () => {
    const { goal } = create(strongInput(), "key-persist");
    mockGoalEngine.lockGoal(goal.id, STUDENT, "key-lock-1");
    const reloaded = mockGoalEngine.getActiveGoal(STUDENT);
    expect(reloaded?.status).toBe("locked");
    expect(reloaded?.id).toBe(goal.id);
  });
});

describe("engine — explicit revision (§5)", () => {
  it("revises a locked goal: old one becomes revised, a fresh editable copy appears", () => {
    const { goal } = create(strongInput(), "key-revise");
    mockGoalEngine.lockGoal(goal.id, STUDENT, "key-lock-1");

    const { goal: revision } = mockGoalEngine.reviseGoal(goal.id, STUDENT);
    expect(revision.id).not.toBe(goal.id);
    expect(revision.status).not.toBe("locked");
    expect(revision.lockedAt).toBeNull();
    expect(revision.revisesGoalId).toBe(goal.id);
    // The revised original is no longer the active goal.
    expect(mockGoalEngine.getActiveGoal(STUDENT)?.id).toBe(revision.id);
    expect(mockGoalEngine.getGoal(goal.id, STUDENT).status).toBe("revised");
  });

  it("rejects revision of a goal that is not locked", () => {
    const { goal } = create(
      strongInput({ desiredOutcome: "I want to learn more about coding in general" }),
      "key-rev-bad",
    );
    expect(() => mockGoalEngine.reviseGoal(goal.id, STUDENT)).toThrow(/invalid_transition/);
  });
});

describe("engine — ownership isolation (§16)", () => {
  it("refuses to expose another student's goal", () => {
    const { goal } = create(strongInput(), "key-own");
    expect(() => mockGoalEngine.getGoal(goal.id, "student_other")).toThrow(/forbidden/);
    expect(() => mockGoalEngine.lockGoal(goal.id, "student_other", "k")).toThrow(/forbidden/);
  });

  it("404s on unknown goal ids", () => {
    expect(() => mockGoalEngine.getGoal("goal_missing", STUDENT)).toThrow(/goal_not_found/);
  });
});
