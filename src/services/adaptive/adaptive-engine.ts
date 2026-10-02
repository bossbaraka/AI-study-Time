/**
 * Adaptive Learning Engine — the heart.
 *
 * Deterministic policy first. LLM only where language generation is
 * actually useful (verbalizing the reason). The policy decides ACTION;
 * the LLM never decides to advance or remediate.
 *
 * Priority order (highest first) — mirrors the pedagogical rationale:
 *   1. Prerequisite gap → REMEDIATE (fix foundations first)
 *   2. Misconception high → REMEDIATE
 *   3. Retrieval low → RETRIEVE
 *   4. Retention declining → REVIEW
 *   5. Transfer low && knowledge high → TRANSFER
 *   6. Fluency low && knowledge high → PRACTICE
 *   7. Hint dependency high → PRACTICE (without hints)
 *   8. Weak overall → EXPLAIN
 *   9. Stable mastery → ADVANCE
 *   10. Otherwise → PRACTICE or REST (based on evidence streak)
 */

import type { ConceptState } from "@/types/concept-state";
import type { DiagnosisInput, AdaptiveInput, NextLearningAction, AdaptiveDecision, AdaptiveAction } from "@/types/adaptive";

function clamp01(n: number): number { return Math.min(1, Math.max(0, n)); }

function scoreAction(
  action: AdaptiveAction,
  conceptId: string | null,
  reason: string,
  priority: number,
): NextLearningAction {
  return { action, conceptId, unitId: null, reason, priority, metadata: {} };
}

export function decideAdaptive(input: AdaptiveInput): AdaptiveDecision {
  const { conceptStates, diagnoses } = input;

  if (conceptStates.length === 0 || diagnoses.length === 0) {
    const primary = scoreAction("EXPLAIN", null,
      "No learning evidence yet — start with an explanation to build the first mental model.", 10);
    return { primary, alternatives: [], evaluatedAt: new Date().toISOString() };
  }

  // Build scored candidates per concept
  const candidates: NextLearningAction[] = [];

  for (const diag of diagnoses) {
    const state = conceptStates.find((s) => s.conceptId === diag.conceptId);
    if (!state) continue;

    // 1. Prerequisite gap
    if (diag.prerequisiteGap) {
      candidates.push(scoreAction("REMEDIATE", diag.conceptId,
        `Prerequisite gap detected for ${diag.conceptId} — strengthen the foundation before advancing.`, 95));
      continue;
    }

    // 2. Misconception
    if (diag.misconception) {
      candidates.push(scoreAction("REMEDIATE", diag.conceptId,
        `Misconception risk is high for ${diag.conceptId} — targeted remediation is needed before practice will stick.`, 90));
      continue;
    }

    // 3. Retrieval gap: knows conceptually but cannot recall under test
    if (diag.retrievalGap) {
      candidates.push(scoreAction("RETRIEVE", diag.conceptId,
        `Knowledge is present for ${diag.conceptId} but retrieval is weak — a retrieval exercise will consolidate memory.`, 85));
      continue;
    }

    // 4. Retention gap
    if (diag.retentionGap) {
      candidates.push(scoreAction("REVIEW", diag.conceptId,
        `Retention is declining for ${diag.conceptId} — spaced review prevents forgetting.`, 80));
      continue;
    }

    // 5. Transfer gap
    if (diag.transferGap) {
      candidates.push(scoreAction("TRANSFER", diag.conceptId,
        `Knowledge is solid for ${diag.conceptId} but transfer evidence is limited — an applied task in a new context is next.`, 75));
      continue;
    }

    // 6. Fluency gap
    if (diag.fluencyGap) {
      candidates.push(scoreAction("PRACTICE", diag.conceptId,
        `Understanding is present for ${diag.conceptId} but fluency is low — timed practice will build speed without sacrificing accuracy.`, 70));
      continue;
    }

    // 7. Hint dependency
    if (diag.hintDependency) {
      candidates.push(scoreAction("PRACTICE", diag.conceptId,
        `Hint dependency is high for ${diag.conceptId} — practice without hints is the right next step.`, 68));
      continue;
    }

    // 8. Weak overall
    if (diag.weakness) {
      candidates.push(scoreAction("EXPLAIN", diag.conceptId,
        `Concept ${diag.conceptId} is still developing — a clear explanation with a worked example will repair the model.`, 60));
      continue;
    }

    // 9. Strong — advance or rest
    if (diag.strength) {
      // If retention and transfer also strong, advance; otherwise transfer/practice still needed but strength suggests moving on
      if (state.transfer >= 0.6 && state.retention >= 0.6) {
        candidates.push(scoreAction("ADVANCE", diag.conceptId,
          `Mastery is stable for ${diag.conceptId} — you are ready for the next concept.`, 50));
      } else {
        candidates.push(scoreAction("TRANSFER", diag.conceptId,
          `Mastery is strong for ${diag.conceptId} — extend it by applying the idea in a new problem.`, 55));
      }
      continue;
    }

    // 10. Default: developing but no specific gap
    candidates.push(scoreAction("PRACTICE", diag.conceptId,
      `Continue deliberate practice for ${diag.conceptId} to move developing knowledge toward fluency.`, 40));
  }

  // If nothing matched (e.g., all not_started), fallback
  if (candidates.length === 0) {
    const fallback = scoreAction("PRACTICE", null,
      "Continue the current unit — steady practice builds the evidence the system needs to personalize.", 30);
    candidates.push(fallback);
  }

  // Handle recovery / rest overrides
  if (input.hasActiveRecovery) {
    // Remediation during recovery is top priority
    const recovery = scoreAction("REMEDIATE", candidates[0]?.conceptId ?? null,
      "Recovery is active — focus on the recovery task until the diagnosis clears.", 100);
    candidates.unshift(recovery);
  }

  if (input.recentEvidenceCount > 8 && input.streakDays > 5) {
    // Heavy streak — suggest REST as alternative, not primary
    const rest = scoreAction("REST", null,
      "You have been highly consistent — a short rest will consolidate retention better than another intense session.", 5);
    candidates.push(rest);
  }

  // Sort by priority descending
  candidates.sort((a, b) => b.priority - a.priority);
  const primary = candidates[0]!;
  const alternatives = candidates.slice(1, 3);

  return { primary, alternatives, evaluatedAt: new Date().toISOString() };
}

export function createAdaptiveEngine() {
  return {
    decide: decideAdaptive,
  };
}

export const adaptiveEngine = createAdaptiveEngine();
