import { describe, it, expect } from "vitest";
import { masteryEngine } from "./mastery-engine";
import type { Evidence } from "@/types/evidence";

function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: "ev_1",
    studentId: "stu_1",
    conceptId: "concept_js_closures",
    kind: "solution",
    payload: { solution: "test" },
    score: 1,
    timeSpentSeconds: 60,
    attemptCount: 1,
    hintUsed: false,
    hintCount: 0,
    learningUnitId: null,
    roadmapId: null,
    assessmentSessionId: null,
    testAttemptId: null,
    immutable: false,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("mastery engine", () => {
  it("starts from zero and increases knowledge on correct evidence", () => {
    const ev = makeEvidence({ score: 1 });
    const { next } = masteryEngine.apply(ev, null);
    expect(next.knowledge).toBeGreaterThan(0);
    expect(next.evidenceCount).toBe(1);
    expect(next.retrieval).toBeGreaterThan(0);
  });

  it("is deterministic: same inputs produce same outputs", () => {
    const ev = makeEvidence({ score: 0.6, hintUsed: false });
    const prev = null;
    const a = masteryEngine.apply(ev, prev);
    const b = masteryEngine.apply(ev, prev);
    expect(a.next.knowledge).toBe(b.next.knowledge);
    expect(a.next.retrieval).toBe(b.next.retrieval);
  });

  it("hint reduces knowledge gain", () => {
    const evNoHint = makeEvidence({ score: 1, hintUsed: false });
    const evHint = makeEvidence({ score: 1, hintUsed: true });
    const { next: noHintState } = masteryEngine.apply(evNoHint, null);
    const { next: hintState } = masteryEngine.apply(evHint, null);
    expect(noHintState.knowledge).toBeGreaterThan(hintState.knowledge);
    expect(hintState.hintDependency).toBeGreaterThan(noHintState.hintDependency);
  });

  it("repeated incorrect increases misconceptionRisk", () => {
    let state = null as unknown as ReturnType<typeof masteryEngine.apply>["next"] | null;
    const bad = makeEvidence({ score: 0, attemptCount: 2 });
    // Apply three bad evidences
    for (let i = 0; i < 3; i++) {
      const { next } = masteryEngine.apply({ ...bad, id: `bad_${i}` }, state);
      state = next;
    }
    expect(state!.misconceptionRisk).toBeGreaterThan(0.3);
  });

  it("increments stateVersion on each apply", () => {
    const ev = makeEvidence({ score: 1 });
    const { next: s1 } = masteryEngine.apply(ev, null);
    const { next: s2 } = masteryEngine.apply({ ...ev, id: "ev2" }, s1);
    expect(s2.stateVersion).toBe(s1.stateVersion + 1);
  });

  it("fluency reflects timeSpent", () => {
    const fast = makeEvidence({ score: 1, timeSpentSeconds: 50 });
    const slow = makeEvidence({ score: 1, timeSpentSeconds: 500 });
    const { next: fastState } = masteryEngine.apply(fast, null);
    const { next: slowState } = masteryEngine.apply(slow, null);
    expect(fastState.fluency).toBeGreaterThan(slowState.fluency);
  });
});
