/**
 * Recovery Engine — intervention teaching, not motivational text.
 *
 * Trigger: diagnosis shows repeated failure pattern.
 * Output: recovery strategy → recovery mission → evidence → re-evaluation.
 * Measurable: recovery succeeds when post-recovery evidence shows mastery lift.
 */

import type { ConceptState } from "@/types/concept-state";
import type { ConceptDiagnosis } from "@/services/diagnosis/diagnosis-engine";

export type RecoveryStrategy = "reteach" | "practice_gap" | "transfer_bridge" | "fluency_drill" | "prerequisite_repair";

export interface RecoveryPlan {
  conceptId: string;
  conceptName: string;
  strategy: RecoveryStrategy;
  steps: RecoveryStep[];
  triggerDiagnosis: ConceptDiagnosis;
  createdAt: string;
}

export interface RecoveryStep {
  order: number;
  title: string;
  description: string;
  kind: "explain" | "practice" | "transfer" | "recall" | "assessment";
  completed: boolean;
}

export function planRecovery(diagnosis: ConceptDiagnosis, state: ConceptState | null): RecoveryPlan | null {
  const hasFailure = diagnosis.issues.includes("weakness") || diagnosis.issues.includes("misconception") || diagnosis.issues.includes("prerequisite_gap");
  const isRepeated = state ? state.evidenceCount >= 3 && state.knowledge < 0.5 : false;
  const hintTrap = diagnosis.issues.includes("hint_dependency");

  if (!hasFailure && !isRepeated) return null;

  let strategy: RecoveryStrategy = "practice_gap";
  if (diagnosis.issues.includes("misconception")) strategy = "reteach";
  else if (diagnosis.issues.includes("prerequisite_gap")) strategy = "prerequisite_repair";
  else if (diagnosis.issues.includes("transfer_gap")) strategy = "transfer_bridge";
  else if (diagnosis.issues.includes("fluency_gap") || hintTrap) strategy = "fluency_drill";

  const steps: RecoveryStep[] = [];
  switch (strategy) {
    case "reteach":
      steps.push(
        { order: 1, title: `Re-explain ${diagnosis.conceptName}`, description: "A concise, correct mental model with a worked example.", kind: "explain", completed: false },
        { order: 2, title: "Guided practice", description: "Two scaffolded problems with feedback, no hints hidden.", kind: "practice", completed: false },
        { order: 3, title: "Checkpoint recall", description: "One retrieval check without notes.", kind: "recall", completed: false },
      );
      break;
    case "prerequisite_repair":
      steps.push(
        { order: 1, title: "Strengthen prerequisites", description: "Review the concepts this one depends on.", kind: "explain", completed: false },
        { order: 2, title: "Re-attempt the concept", description: "Practice the target concept after foundations are solid.", kind: "practice", completed: false },
        { order: 3, title: "Transfer check", description: "Apply the concept in a new problem.", kind: "transfer", completed: false },
      );
      break;
    case "transfer_bridge":
      steps.push(
        { order: 1, title: "Bridge to application", description: "See how the concept solves a real problem.", kind: "explain", completed: false },
        { order: 2, title: "Transfer exercise", description: "Solve an unfamiliar problem that requires this concept.", kind: "transfer", completed: false },
        { order: 3, title: "Reflection", description: "Explain why the solution works and when to use it again.", kind: "explain", completed: false },
      );
      break;
    case "fluency_drill":
      steps.push(
        { order: 1, title: "Speed-aware practice", description: "Three timed exercises focusing on accuracy then speed.", kind: "practice", completed: false },
        { order: 2, title: "No-hint chain", description: "Complete the set without requesting hints.", kind: "practice", completed: false },
        { order: 3, title: "Retention check tomorrow", description: "A single recall prompt checks stability.", kind: "recall", completed: false },
      );
      break;
    case "practice_gap":
    default:
      steps.push(
        { order: 1, title: `Practice ${diagnosis.conceptName}`, description: "Deliberate practice with immediate feedback.", kind: "practice", completed: false },
        { order: 2, title: "Apply independently", description: "Solve a new problem without guidance.", kind: "transfer", completed: false },
        { order: 3, title: "Quick assessment", description: "A short diagnostic verifies the repair.", kind: "assessment", completed: false },
      );
      break;
  }

  return {
    conceptId: diagnosis.conceptId,
    conceptName: diagnosis.conceptName,
    strategy,
    steps,
    triggerDiagnosis: diagnosis,
    createdAt: new Date().toISOString(),
  };
}

export function createRecoveryEngine() {
  return { plan: planRecovery };
}

export const recoveryEngine = createRecoveryEngine();
