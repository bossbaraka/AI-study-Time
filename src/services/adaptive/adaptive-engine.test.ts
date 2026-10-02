import { describe, it, expect } from "vitest";
import { decideAdaptive } from "./adaptive-engine";
import type { ConceptState } from "@/types/concept-state";
import type { DiagnosisInput } from "@/types/adaptive";

function state(id: string, overrides: Partial<ConceptState> = {}): ConceptState {
  return {
    conceptId: id,
    studentId: "stu_1",
    knowledge: 0.5,
    retrieval: 0.5,
    retention: 0.5,
    transfer: 0.5,
    fluency: 0.5,
    confidence: 0.5,
    hintDependency: 0.1,
    misconceptionRisk: 0.1,
    evidenceCount: 3,
    lastEvidenceAt: new Date().toISOString(),
    stateVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function diag(id: string, overrides: Partial<DiagnosisInput> = {}): DiagnosisInput {
  return {
    conceptId: id,
    strength: false,
    weakness: false,
    misconception: false,
    retrievalGap: false,
    retentionGap: false,
    transferGap: false,
    fluencyGap: false,
    confidenceMismatch: false,
    hintDependency: false,
    prerequisiteGap: false,
    ...overrides,
  };
}

describe("adaptive engine", () => {
  it("returns EXPLAIN when no evidence", () => {
    const decision = decideAdaptive({
      studentId: "stu_1",
      goalId: null,
      roadmapId: null,
      currentUnitId: null,
      conceptStates: [],
      diagnoses: [],
      recentEvidenceCount: 0,
      hasActiveRecovery: false,
      streakDays: 0,
    });
    expect(decision.primary.action).toBe("EXPLAIN");
    expect(decision.primary.reason.length).toBeGreaterThan(10);
  });

  it("prioritizes REMEDIATE for misconception", () => {
    const decision = decideAdaptive({
      studentId: "stu",
      goalId: null,
      roadmapId: null,
      currentUnitId: null,
      conceptStates: [state("c1")],
      diagnoses: [diag("c1", { misconception: true })],
      recentEvidenceCount: 2,
      hasActiveRecovery: false,
      streakDays: 1,
    });
    expect(decision.primary.action).toBe("REMEDIATE");
  });

  it("prioritizes RETRIEVE for retrieval_gap over TRANSFER", () => {
    const decision = decideAdaptive({
      studentId: "stu",
      goalId: null,
      roadmapId: null,
      currentUnitId: null,
      conceptStates: [state("c1"), state("c2")],
      diagnoses: [diag("c1", { retrievalGap: true }), diag("c2", { transferGap: true })],
      recentEvidenceCount: 2,
      hasActiveRecovery: false,
      streakDays: 1,
    });
    expect(decision.primary.action).toBe("RETRIEVE");
    expect(decision.primary.conceptId).toBe("c1");
  });

  it("chooses TRANSFER when knowledge high but transfer low", () => {
    const decision = decideAdaptive({
      studentId: "stu",
      goalId: null,
      roadmapId: null,
      currentUnitId: null,
      conceptStates: [state("c1", { knowledge: 0.9, transfer: 0.2 })],
      diagnoses: [diag("c1", { transferGap: true })],
      recentEvidenceCount: 1,
      hasActiveRecovery: false,
      streakDays: 1,
    });
    expect(decision.primary.action).toBe("TRANSFER");
  });

  it("chooses ADVANCE when strength stable", () => {
    const decision = decideAdaptive({
      studentId: "stu",
      goalId: null,
      roadmapId: null,
      currentUnitId: null,
      conceptStates: [state("c1", { knowledge: 0.9, retrieval: 0.8, transfer: 0.7, retention: 0.8 })],
      diagnoses: [diag("c1", { strength: true })],
      recentEvidenceCount: 1,
      hasActiveRecovery: false,
      streakDays: 1,
    });
    expect(["ADVANCE", "TRANSFER"]).toContain(decision.primary.action);
  });

  it("is deterministic: same inputs => same primary", () => {
    const input = {
      studentId: "stu",
      goalId: null as string | null,
      roadmapId: null as string | null,
      currentUnitId: null as string | null,
      conceptStates: [state("c1")],
      diagnoses: [diag("c1", { retrievalGap: true })],
      recentEvidenceCount: 1,
      hasActiveRecovery: false,
      streakDays: 1,
    };
    const a = decideAdaptive(input);
    const b = decideAdaptive(input);
    expect(a.primary.action).toBe(b.primary.action);
    expect(a.primary.reason).toBe(b.primary.reason);
  });

  it("includes Why This Action reason that is non-empty", () => {
    const decision = decideAdaptive({
      studentId: "stu",
      goalId: null,
      roadmapId: null,
      currentUnitId: null,
      conceptStates: [state("c1")],
      diagnoses: [diag("c1", { weakness: true })],
      recentEvidenceCount: 1,
      hasActiveRecovery: false,
      streakDays: 0,
    });
    expect(decision.primary.reason).toMatch(/.+/);
    expect(decision.primary.priority).toBeGreaterThan(0);
  });
});
