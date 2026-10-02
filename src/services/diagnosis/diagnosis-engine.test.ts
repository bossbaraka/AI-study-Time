import { describe, it, expect } from "vitest";
import { diagnoseConcept } from "./diagnosis-engine";
import type { ConceptState } from "@/types/concept-state";
import type { Concept } from "@/types/concept";

function state(overrides: Partial<ConceptState> = {}): ConceptState {
  return {
    conceptId: "concept_js_closures",
    studentId: "stu_1",
    knowledge: 0.8,
    retrieval: 0.8,
    retention: 0.7,
    transfer: 0.7,
    fluency: 0.7,
    confidence: 0.7,
    hintDependency: 0.1,
    misconceptionRisk: 0.1,
    evidenceCount: 5,
    lastEvidenceAt: new Date().toISOString(),
    stateVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function concept(overrides: Partial<Concept> = {}): Concept {
  return {
    id: "concept_js_closures",
    name: "Closures",
    description: "x",
    domain: "javascript",
    prerequisites: [],
    difficulty: 3,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("diagnosis engine", () => {
  it("returns not_started when no evidence", () => {
    const d = diagnoseConcept(null, concept());
    expect(d.level).toBe("not_started");
  });

  it("classifies strong when all dimensions high", () => {
    const d = diagnoseConcept(state({ knowledge: 0.9, retrieval: 0.8, transfer: 0.7 }), concept());
    expect(d.level).toBe("strong");
    expect(d.issues).toContain("strength");
  });

  it("detects retrieval_gap when knowledge high but retrieval low", () => {
    const d = diagnoseConcept(state({ knowledge: 0.9, retrieval: 0.2 }), concept());
    expect(d.issues).toContain("retrieval_gap");
  });

  it("detects transfer_gap when knowledge high but transfer low", () => {
    const d = diagnoseConcept(state({ knowledge: 0.9, transfer: 0.2 }), concept());
    expect(d.issues).toContain("transfer_gap");
  });

  it("detects hint_dependency when hintDependency high", () => {
    const d = diagnoseConcept(state({ hintDependency: 0.8 }), concept());
    expect(d.issues).toContain("hint_dependency");
  });

  it("detects misconception when risk high", () => {
    const d = diagnoseConcept(state({ misconceptionRisk: 0.8 }), concept());
    expect(d.issues).toContain("misconception");
  });

  it("detects prerequisite_gap when prerequisite state is weak", () => {
    const prereqState = state({ conceptId: "concept_js_scope", knowledge: 0.2, evidenceCount: 2 });
    const targetConcept = concept({ id: "concept_js_closures", prerequisites: ["concept_js_scope"] });
    const d = diagnoseConcept(state({ knowledge: 0.3, evidenceCount: 2 }), targetConcept, [prereqState]);
    expect(d.issues).toContain("prerequisite_gap");
  });

  it("detects confidence mismatch", () => {
    const d = diagnoseConcept(state({ knowledge: 0.9, confidence: 0.2 }), concept());
    expect(d.issues).toContain("confidence_mismatch");
  });
});
