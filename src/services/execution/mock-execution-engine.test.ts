/**
 * Mock execution engine (Phase 7): lifecycle over a REAL Stage 6 roadmap
 * (goal engine → roadmap engine), ownership & isolation, dependency
 * gates, idempotency, refresh persistence, result semantics.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { authService } from "@/services/auth.service";
import {
  EvidenceInvalidError,
  ExecutionConflictError,
  ExecutionNotFoundError,
  LearningUnitUnavailableError,
} from "@/services/execution/execution-errors";
import { mockExecutionEngine } from "@/services/engines";
import { InvalidExecutionTransitionError } from "@/services/execution/execution-state-machine";
import { mockGoalEngine } from "@/services/engines";
import { mockRoadmapEngine } from "@/services/engines";
import type { GoalDiscoveryInput } from "@/types/goal";
import type { Roadmap } from "@/types/roadmap";

const PASSWORD = "securePass1";
const STUDENT_EMAIL = "layla.hassan@example.com";
const STORAGE_KEY = "mureeh.mock.executions.v1";

const SOLID_SOLUTION =
  "I built makeCounter(): a closure keeps `count` private and the returned function increments it.";
const SOLID_REASONING =
  "Closures capture the lexical scope at creation, so `count` survives between calls.";
const THIN_SOLUTION = "Did the exercise.";
// Above the attempt floor (12) but below sufficiency (30) → needs_review.
const THIN_REASONING = "It works fine here.";

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

let studentId = "";
let roadmap: Roadmap;

/** Deterministic first unit of the generated roadmap. */
function firstUnitId(): string {
  const ordered = [...roadmap.milestones].sort((a, b) => a.order - b.order);
  const units = [...ordered[0]!.learningUnits].sort((a, b) => a.order - b.order);
  return units[0]!.id;
}

function laterMilestoneUnitId(): string {
  const ordered = [...roadmap.milestones].sort((a, b) => a.order - b.order);
  return ordered[ordered.length - 1]!.learningUnits[0]!.id;
}

function allUnitIds(): string[] {
  return [...roadmap.milestones]
    .sort((a, b) => a.order - b.order)
    .flatMap((milestone) =>
      [...milestone.learningUnits].sort((a, b) => a.order - b.order).map((unit) => unit.id),
    );
}

async function passUnit(unitId: string, who: string = studentId): Promise<void> {
  await mockExecutionEngine.startLearningUnit(unitId, who);
  await mockExecutionEngine.submitEvidence(
    unitId,
    { solution: SOLID_SOLUTION, reasoning: SOLID_REASONING },
    who,
  );
  const evaluated = await mockExecutionEngine.evaluateExecution(unitId, who);
  expect(evaluated.result).toBe("passed");
}

/** Seeds a locked goal + generated roadmap for an arbitrary student id. */
async function seedRoadmapFor(who: string, key: string): Promise<Roadmap> {
  const created = await mockGoalEngine.createGoal(jsInput(), {
    studentId: who,
    idempotencyKey: `${key}-c`,
    diagnosisContext: null,
  });
  const locked = await mockGoalEngine.lockGoal(created.goal.id, who, `${key}-l`);
  return (await mockRoadmapEngine.generateRoadmap(locked.id, who)).roadmap;
}

beforeEach(async () => {
  await mockExecutionEngine.__reset();
  await mockRoadmapEngine.__reset();
  await mockGoalEngine.__reset();
  const { session } = await authService.login({ email: STUDENT_EMAIL, password: PASSWORD });
  studentId = session.user.id;
  roadmap = await seedRoadmapFor(studentId, "exec-main");
});

describe("execution engine — view & context resolution", () => {
  it("returns a null view when the student has no roadmap", async () => {
    await mockRoadmapEngine.__reset();
    expect(await mockExecutionEngine.getExecutionView(studentId)).toBeNull();
  });

  it("derives the fresh-roadmap view: one available unit, rest blocked", async () => {
    const view = await mockExecutionEngine.getExecutionView(studentId);
    expect(view?.roadmapId).toBe(roadmap.id);
    expect(view?.roadmapStatus).toBe("active");
    expect(view?.currentUnit?.id).toBe(firstUnitId());
    expect(view?.allUnitsPassed).toBe(false);
    expect(view?.unitStates[firstUnitId()]).toBe("available");
    expect(view?.unitStates[laterMilestoneUnitId()]).toBe("blocked");
  });

  it("builds full unit context with honest next-unit lookahead", async () => {
    const context = await mockExecutionEngine.getUnitContext(firstUnitId(), studentId);
    expect(context.roadmap.id).toBe(roadmap.id);
    expect(context.milestone.id).toBe(roadmap.milestones[0]!.id);
    expect(context.unit.id).toBe(firstUnitId());
    expect(context.execution).toBeNull();
    expect(context.status).toBe("available");
    expect(context.allUnitsPassed).toBe(false);
    // Next unit = the one that opens when THIS passes.
    const ids = allUnitIds();
    expect(context.nextUnit?.id).toBe(ids[1]);
  });

  it("unknown unit ids are not found — never leaked as something else", async () => {
    await expect(mockExecutionEngine.getUnitContext("unit_ghost", studentId)).rejects.toThrow(
      ExecutionNotFoundError,
    );
    await expect(mockExecutionEngine.startLearningUnit("unit_ghost", studentId)).rejects.toThrow(
      ExecutionNotFoundError,
    );
  });

  it("getExecutionState: null before start, the record after", async () => {
    expect(await mockExecutionEngine.getExecutionState(firstUnitId(), studentId)).toBeNull();
    await mockExecutionEngine.startLearningUnit(firstUnitId(), studentId);
    const state = await mockExecutionEngine.getExecutionState(firstUnitId(), studentId);
    expect(state?.status).toBe("in_progress");
    expect(state?.studentId).toBe(studentId);
  });
});

describe("execution engine — lifecycle", () => {
  it("start creates an in_progress record owned by the session student", async () => {
    const started = await mockExecutionEngine.startLearningUnit(firstUnitId(), studentId);
    expect(started.status).toBe("in_progress");
    expect(started.studentId).toBe(studentId);
    expect(started.roadmapId).toBe(roadmap.id);
    expect(started.startedAt).toBeTruthy();
  });

  it("submit stores trimmed evidence and moves to submitted", async () => {
    await mockExecutionEngine.startLearningUnit(firstUnitId(), studentId);
    const submitted = await mockExecutionEngine.submitEvidence(
      firstUnitId(),
      { solution: `  ${SOLID_SOLUTION}  `, reasoning: ` ${SOLID_REASONING} ` },
      studentId,
    );
    expect(submitted.status).toBe("submitted");
    expect(submitted.evidence).toMatchObject({
      kind: "text",
      solution: SOLID_SOLUTION,
      reasoning: SOLID_REASONING,
    });
    expect(submitted.submittedAt).toBeTruthy();
  });

  it("evaluate applies the development evaluator → passed with timestamp", async () => {
    await mockExecutionEngine.startLearningUnit(firstUnitId(), studentId);
    await mockExecutionEngine.submitEvidence(
      firstUnitId(),
      { solution: SOLID_SOLUTION, reasoning: SOLID_REASONING },
      studentId,
    );
    const evaluated = await mockExecutionEngine.evaluateExecution(firstUnitId(), studentId);
    expect(evaluated.status).toBe("evaluated");
    expect(evaluated.result).toBe("passed");
    expect(evaluated.evaluatedAt).toBeTruthy();
  });

  it("thin evidence evaluates to needs_review — never a false pass", async () => {
    await mockExecutionEngine.startLearningUnit(firstUnitId(), studentId);
    await mockExecutionEngine.submitEvidence(
      firstUnitId(),
      { solution: THIN_SOLUTION, reasoning: THIN_REASONING },
      studentId,
    );
    const evaluated = await mockExecutionEngine.evaluateExecution(firstUnitId(), studentId);
    expect(evaluated.result).toBe("needs_review");
  });

  it("trivial evidence evaluates to failed", async () => {
    await mockExecutionEngine.startLearningUnit(firstUnitId(), studentId);
    await mockExecutionEngine.submitEvidence(firstUnitId(), { solution: "idk", reasoning: "hmm" }, studentId);
    const evaluated = await mockExecutionEngine.evaluateExecution(firstUnitId(), studentId);
    expect(evaluated.result).toBe("failed");
  });

  it("persists through a simulated refresh (localStorage round-trip)", async () => {
    await mockExecutionEngine.startLearningUnit(firstUnitId(), studentId);
    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const stored = JSON.parse(raw!) as Array<{ learningUnitId: string; status: string }>;
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ learningUnitId: firstUnitId(), status: "in_progress" });
    // A fresh read reconstructs the same state.
    expect((await mockExecutionEngine.getExecutionState(firstUnitId(), studentId))?.status).toBe(
      "in_progress",
    );
  });
});

describe("execution engine — invalid transitions fail safely (§11)", () => {
  it("cannot submit without starting", async () => {
    await expect(
      mockExecutionEngine.submitEvidence(
        firstUnitId(),
        { solution: SOLID_SOLUTION, reasoning: SOLID_REASONING },
        studentId,
      ),
    ).rejects.toThrow(InvalidExecutionTransitionError);
  });

  it("cannot evaluate without submitting", async () => {
    await mockExecutionEngine.startLearningUnit(firstUnitId(), studentId);
    await expect(mockExecutionEngine.evaluateExecution(firstUnitId(), studentId)).rejects.toThrow(
      InvalidExecutionTransitionError,
    );
  });

  it("a passed unit never reopens", async () => {
    await passUnit(firstUnitId());
    await expect(mockExecutionEngine.startLearningUnit(firstUnitId(), studentId)).rejects.toThrow(
      InvalidExecutionTransitionError,
    );
  });

  it("needs_review reopens through the explicit retry edge, keeping prior evidence", async () => {
    await mockExecutionEngine.startLearningUnit(firstUnitId(), studentId);
    await mockExecutionEngine.submitEvidence(
      firstUnitId(),
      { solution: THIN_SOLUTION, reasoning: THIN_REASONING },
      studentId,
    );
    await mockExecutionEngine.evaluateExecution(firstUnitId(), studentId);

    const reopened = await mockExecutionEngine.startLearningUnit(firstUnitId(), studentId);
    expect(reopened.status).toBe("in_progress");
    expect(reopened.evidence?.solution).toBe(THIN_SOLUTION); // editable prefill

    // The retry produces a genuinely stronger submission.
    await mockExecutionEngine.submitEvidence(
      firstUnitId(),
      { solution: SOLID_SOLUTION, reasoning: SOLID_REASONING },
      studentId,
    );
    expect((await mockExecutionEngine.evaluateExecution(firstUnitId(), studentId)).result).toBe("passed");
  });

  it("empty evidence is rejected before it can corrupt state", async () => {
    await mockExecutionEngine.startLearningUnit(firstUnitId(), studentId);
    await expect(
      mockExecutionEngine.submitEvidence(firstUnitId(), { solution: "  ", reasoning: "" }, studentId),
    ).rejects.toThrow(EvidenceInvalidError);
    expect((await mockExecutionEngine.getExecutionState(firstUnitId(), studentId))?.status).toBe(
      "in_progress",
    );
  });

  it("resubmitting different evidence over a submission conflicts", async () => {
    await mockExecutionEngine.startLearningUnit(firstUnitId(), studentId);
    await mockExecutionEngine.submitEvidence(
      firstUnitId(),
      { solution: SOLID_SOLUTION, reasoning: SOLID_REASONING },
      studentId,
    );
    await expect(
      mockExecutionEngine.submitEvidence(
        firstUnitId(),
        { solution: "something else entirely", reasoning: "different reasoning here" },
        studentId,
      ),
    ).rejects.toThrow(ExecutionConflictError);
  });
});

describe("execution engine — dependency gates (§6.5/§12)", () => {
  it("a blocked unit cannot start", async () => {
    await expect(mockExecutionEngine.startLearningUnit(laterMilestoneUnitId(), studentId)).rejects.toThrow(
      LearningUnitUnavailableError,
    );
  });

  it("later units within the milestone stay blocked until earlier ones pass", async () => {
    const ids = allUnitIds();
    expect(ids.length).toBeGreaterThan(1);
    await expect(mockExecutionEngine.startLearningUnit(ids[1]!, studentId)).rejects.toThrow(
      LearningUnitUnavailableError,
    );
    await passUnit(ids[0]!);
    expect((await mockExecutionEngine.startLearningUnit(ids[1]!, studentId)).status).toBe("in_progress");
  });

  it("passing a whole milestone unlocks the next milestone's first unit", async () => {
    const milestoneA = [...roadmap.milestones].sort((a, b) => a.order - b.order)[0]!;
    const unitA = [...milestoneA.learningUnits].sort((a, b) => a.order - b.order);
    for (const unit of unitA) await passUnit(unit.id);

    const view = await mockExecutionEngine.getExecutionView(studentId);
    const milestoneB = [...roadmap.milestones].sort((a, b) => a.order - b.order)[1]!;
    const firstB = [...milestoneB.learningUnits].sort((a, b) => a.order - b.order)[0]!;
    expect(view?.unitStates[firstB.id]).toBe("available");
    expect(view?.currentUnit?.id).toBe(firstB.id);
  });

  it("a failed unit keeps its dependents unavailable", async () => {
    await mockExecutionEngine.startLearningUnit(firstUnitId(), studentId);
    await mockExecutionEngine.submitEvidence(
      firstUnitId(),
      { solution: "idk", reasoning: "hmm" },
      studentId,
    );
    await mockExecutionEngine.evaluateExecution(firstUnitId(), studentId);

    const view = await mockExecutionEngine.getExecutionView(studentId);
    expect(view?.unitStates[firstUnitId()]).toBe("failed");
    expect(view?.currentUnit?.id).toBe(firstUnitId()); // stays the focus
    const ids = allUnitIds();
    expect(ids.slice(1).every((id) => view?.unitStates[id] === "blocked")).toBe(true);
  });

  it("all units passed → no current unit, honest completion flag, roadmap untouched", async () => {
    for (const id of allUnitIds()) await passUnit(id);
    const view = await mockExecutionEngine.getExecutionView(studentId);
    expect(view?.currentUnit).toBeNull();
    expect(view?.allUnitsPassed).toBe(true);
    // The curriculum/plan was never mutated by execution (§14).
    const fresh = await mockRoadmapEngine.getRoadmap(roadmap.id, studentId);
    expect(fresh.status).toBe("active");
    expect(fresh.milestones[0]!.status).toBe("in_progress");
    expect(fresh.updatedAt).toBe(roadmap.updatedAt);
  });

  it("a paused roadmap is not executable", async () => {
    await mockRoadmapEngine.pauseRoadmap(roadmap.id, studentId);
    await expect(mockExecutionEngine.startLearningUnit(firstUnitId(), studentId)).rejects.toThrow(
      LearningUnitUnavailableError,
    );
    // The view still renders (read-only), flagged as paused.
    expect((await mockExecutionEngine.getExecutionView(studentId))?.roadmapStatus).toBe("paused");
  });
});

describe("execution engine — idempotency & isolation (§16/§18)", () => {
  it("repeated starts return the SAME record — never duplicates", async () => {
    const first = await mockExecutionEngine.startLearningUnit(firstUnitId(), studentId);
    const second = await mockExecutionEngine.startLearningUnit(firstUnitId(), studentId);
    expect(second.id).toBe(first.id);
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as unknown[];
    expect(stored).toHaveLength(1);
  });

  it("concurrent starts (Promise.all through the async seam) create one record", async () => {
    const { executionService } = await import("@/services/execution.service");
    const [a, b] = await Promise.all([
      executionService.startLearningUnit(firstUnitId()),
      executionService.startLearningUnit(firstUnitId()),
    ]);
    expect(a.id).toBe(b.id);
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as unknown[];
    expect(stored).toHaveLength(1);
  });

  it("re-submitting identical evidence is a safe replay", async () => {
    await mockExecutionEngine.startLearningUnit(firstUnitId(), studentId);
    const first = await mockExecutionEngine.submitEvidence(
      firstUnitId(),
      { solution: SOLID_SOLUTION, reasoning: SOLID_REASONING },
      studentId,
    );
    const replay = await mockExecutionEngine.submitEvidence(
      firstUnitId(),
      { solution: SOLID_SOLUTION, reasoning: SOLID_REASONING },
      studentId,
    );
    expect(replay.id).toBe(first.id);
    expect(replay.status).toBe("submitted");
  });

  it("repeated evaluation replays the same deterministic result", async () => {
    await mockExecutionEngine.startLearningUnit(firstUnitId(), studentId);
    await mockExecutionEngine.submitEvidence(
      firstUnitId(),
      { solution: SOLID_SOLUTION, reasoning: SOLID_REASONING },
      studentId,
    );
    const first = await mockExecutionEngine.evaluateExecution(firstUnitId(), studentId);
    const replay = await mockExecutionEngine.evaluateExecution(firstUnitId(), studentId);
    expect(replay.result).toBe(first.result);
    expect(replay.evaluatedAt).toBe(first.evaluatedAt);
  });

  it("another student's progress never leaks — same unit ids, separate states", async () => {
    // Capability-based unit ids are identical across students' roadmaps.
    const other = await seedRoadmapFor("student_other", "exec-other");
    expect(other.milestones[0]!.learningUnits[0]!.id).toBe(firstUnitId());

    await passUnit(firstUnitId()); // student passes their copy

    const otherView = await mockExecutionEngine.getExecutionView("student_other");
    expect(otherView?.roadmapId).toBe(other.id);
    expect(otherView?.unitStates[firstUnitId()]).toBe("available"); // untouched
    expect(otherView?.currentUnit?.id).toBe(firstUnitId());

    // The other student's record set stays empty.
    expect(await mockExecutionEngine.getExecutionState(firstUnitId(), "student_other")).toBeNull();
  });

  it("a student without any roadmap gets unit_unavailable, not someone else's data", async () => {
    await expect(mockExecutionEngine.getUnitContext(firstUnitId(), "student_ghost")).rejects.toThrow(
      LearningUnitUnavailableError,
    );
    expect(await mockExecutionEngine.getExecutionView("student_ghost")).toBeNull();
  });
});
