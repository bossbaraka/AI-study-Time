/**
 * Diagnosis Engine — deterministic interpretation of ConceptState.
 *
 * Takes a ConceptState (and optionally surrounding states for prerequisite
 * checks) and produces a structured diagnosis that the AdaptiveEngine
 * consumes. No LLM, no percentages shown as truth — the UI maps these
 * codes to supportive language.
 */

import type { ConceptState } from "@/types/concept-state";
import type { Concept } from "@/types/concept";
import type { DiagnosisInput } from "@/types/adaptive";

export interface ConceptDiagnosis {
  conceptId: string;
  conceptName: string;
  level: DiagnosticLevel;
  issues: DiagnosisIssue[];
  signals: DiagnosisSignals;
}

export type DiagnosticLevel = "strong" | "developing" | "weak" | "not_started";
export type DiagnosisIssue =
  | "retrieval_gap"
  | "retention_gap"
  | "transfer_gap"
  | "fluency_gap"
  | "confidence_mismatch"
  | "hint_dependency"
  | "misconception"
  | "prerequisite_gap"
  | "strength"
  | "weakness";

export interface DiagnosisSignals {
  knowledge: number;
  retrieval: number;
  retention: number;
  transfer: number;
  fluency: number;
  confidence: number;
  hintDependency: number;
  misconceptionRisk: number;
}

const THRESHOLDS = {
  strong: 0.7,
  weak: 0.4,
  gap: 0.3, // difference that counts as a gap
  hintHigh: 0.5,
  misconceptionHigh: 0.5,
  confidenceMismatch: 0.3,
};

export function diagnoseConcept(
  state: ConceptState | null | undefined,
  concept: Concept | null | undefined,
  prerequisiteStates?: (ConceptState | null | undefined)[],
): ConceptDiagnosis {
  const conceptId = state?.conceptId ?? concept?.id ?? "unknown";
  const conceptName = concept?.name ?? conceptId;

  if (!state || state.evidenceCount === 0) {
    return {
      conceptId,
      conceptName,
      level: "not_started",
      issues: [],
      signals: emptySignals(),
    };
  }

  const signals: DiagnosisSignals = {
    knowledge: state.knowledge,
    retrieval: state.retrieval,
    retention: state.retention,
    transfer: state.transfer,
    fluency: state.fluency,
    confidence: state.confidence,
    hintDependency: state.hintDependency,
    misconceptionRisk: state.misconceptionRisk,
  };

  const issues: DiagnosisIssue[] = [];

  // Level classification (based on knowledge primarily, but transfer matters for strong)
  let level: DiagnosticLevel;
  if (state.knowledge >= THRESHOLDS.strong && state.retrieval >= 0.6 && state.transfer >= 0.5) level = "strong";
  else if (state.knowledge >= THRESHOLDS.weak) level = "developing";
  else level = "weak";

  // Strength / weakness tags
  if (level === "strong") issues.push("strength");
  if (level === "weak") issues.push("weakness");

  // Retrieval gap: knows but cannot retrieve
  if (state.knowledge - state.retrieval > THRESHOLDS.gap) issues.push("retrieval_gap");

  // Retention gap: knows but not stable over time
  if (state.knowledge - state.retention > THRESHOLDS.gap) issues.push("retention_gap");

  // Transfer gap: knowledge high but transfer low
  if (state.knowledge >= 0.6 && state.knowledge - state.transfer > THRESHOLDS.gap) issues.push("transfer_gap");

  // Fluency gap: knows but slow
  if (state.knowledge >= 0.6 && state.knowledge - state.fluency > THRESHOLDS.gap) issues.push("fluency_gap");

  // Confidence mismatch: high confidence but low knowledge, or vice versa
  if (Math.abs(state.confidence - state.knowledge) > THRESHOLDS.confidenceMismatch) issues.push("confidence_mismatch");

  // Hint dependency
  if (state.hintDependency >= THRESHOLDS.hintHigh) issues.push("hint_dependency");

  // Misconception
  if (state.misconceptionRisk >= THRESHOLDS.misconceptionHigh) issues.push("misconception");

  // Prerequisite gap: any prerequisite state is weak while this is weak
  if (prerequisiteStates && prerequisiteStates.length > 0) {
    const hasWeakPrereq = prerequisiteStates.some((ps) => ps && ps.knowledge < THRESHOLDS.weak && ps.evidenceCount > 0);
    const hasMissingPrereq = prerequisiteStates.some((ps) => !ps || ps.evidenceCount === 0);
    if ((hasWeakPrereq || hasMissingPrereq) && level !== "strong") issues.push("prerequisite_gap");
  }

  return { conceptId, conceptName, level, issues, signals };
}

export function toDiagnosisInput(diagnosis: ConceptDiagnosis): DiagnosisInput {
  return {
    conceptId: diagnosis.conceptId,
    strength: diagnosis.issues.includes("strength"),
    weakness: diagnosis.issues.includes("weakness"),
    misconception: diagnosis.issues.includes("misconception"),
    retrievalGap: diagnosis.issues.includes("retrieval_gap"),
    retentionGap: diagnosis.issues.includes("retention_gap"),
    transferGap: diagnosis.issues.includes("transfer_gap"),
    fluencyGap: diagnosis.issues.includes("fluency_gap"),
    confidenceMismatch: diagnosis.issues.includes("confidence_mismatch"),
    hintDependency: diagnosis.issues.includes("hint_dependency"),
    prerequisiteGap: diagnosis.issues.includes("prerequisite_gap"),
  };
}

function emptySignals(): DiagnosisSignals {
  return {
    knowledge: 0,
    retrieval: 0,
    retention: 0,
    transfer: 0,
    fluency: 0,
    confidence: 0.5,
    hintDependency: 0,
    misconceptionRisk: 0,
  };
}

export function createDiagnosisEngine() {
  return {
    diagnose: diagnoseConcept,
    toInput: toDiagnosisInput,
  };
}

export const diagnosisEngine = createDiagnosisEngine();
