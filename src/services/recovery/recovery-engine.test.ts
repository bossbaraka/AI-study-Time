import { describe, it, expect } from "vitest";
import { planRecovery } from "./recovery-engine";
import type { ConceptDiagnosis } from "@/services/diagnosis/diagnosis-engine";
import type { ConceptState } from "@/types/concept-state";

function diag(overrides: Partial<ConceptDiagnosis> = {}): ConceptDiagnosis {
  return {
    conceptId: "c1",
    conceptName: "Closures",
    level: "weak",
    issues: ["weakness"],
    signals: { knowledge: 0.3, retrieval: 0.2, retention: 0.2, transfer: 0.1, fluency: 0.2, confidence: 0.5, hintDependency: 0.1, misconceptionRisk: 0.2 },
    ...overrides,
  };
}
function state(overrides: Partial<ConceptState> = {}): ConceptState {
  return {
    conceptId: "c1",
    studentId: "stu_1",
    knowledge: 0.3,
    retrieval: 0.2,
    retention: 0.2,
    transfer: 0.1,
    fluency: 0.2,
    confidence: 0.5,
    hintDependency: 0.1,
    misconceptionRisk: 0.2,
    evidenceCount: 4,
    lastEvidenceAt: new Date().toISOString(),
    stateVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("recovery engine", () => {
  it("returns null when no failure", () => {
    const d = diag({ level: "strong", issues: ["strength"] });
    const plan = planRecovery(d, state({ knowledge: 0.9 }));
    expect(plan).toBeNull();
  });

  it("produces reteach strategy for misconception", () => {
    const d = diag({ issues: ["misconception", "weakness"], signals: { knowledge: 0.3, retrieval: 0.2, retention: 0.2, transfer: 0.1, fluency: 0.2, confidence: 0.5, hintDependency: 0.1, misconceptionRisk: 0.8 } });
    const plan = planRecovery(d, state());
    expect(plan?.strategy).toBe("reteach");
    expect(plan?.steps.length).toBeGreaterThan(0);
  });

  it("produces prerequisite_repair for prerequisite_gap", () => {
    const d = diag({ issues: ["prerequisite_gap", "weakness"] });
    const plan = planRecovery(d, state());
    expect(plan?.strategy).toBe("prerequisite_repair");
  });

  it("is deterministic: same diagnosis produces same strategy", () => {
    const d = diag({ issues: ["transfer_gap", "weakness"] });
    const a = planRecovery(d, state());
    const b = planRecovery(d, state());
    expect(a?.strategy).toBe(b?.strategy);
  });

  it("never returns motivational text alone — steps are actionable", () => {
    const d = diag({ issues: ["weakness"] });
    const plan = planRecovery(d, state());
    expect(plan?.steps.every((s) => s.title.length > 5 && s.description.length > 10)).toBe(true);
  });
});
