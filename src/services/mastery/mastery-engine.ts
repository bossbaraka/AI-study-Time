/**
 * Mastery Engine — deterministic, server-authoritative, testable.
 *
 * Evidence ─► MasteryEngine ─► ConceptState update
 *
 * No Math.random(), no LLM, no client-provided score. Every rule is
 * explicit and unit-tested. The engine is pure: it receives the previous
 * ConceptState (or null) and an Evidence record, and returns the next
 * state plus a reason.
 */

import type { Evidence } from "@/types/evidence";
import type { ConceptState, ConceptStateUpdate } from "@/types/concept-state";

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

function ema(prev: number, next: number, alpha: number): number {
  return clamp01(prev * (1 - alpha) + next * alpha);
}

export interface MasteryEngineResult {
  next: ConceptState;
  update: ConceptStateUpdate;
}

export function createMasteryEngine() {
  return {
    /**
     * Compute the next ConceptState from one evidence.
     * Deterministic: same inputs always produce same outputs.
     */
    apply(evidence: Evidence, previous: ConceptState | null): MasteryEngineResult {
      const now = new Date().toISOString();
      const score = evidence.score ?? 0; // 0..1, null => 0
      const hintUsed = evidence.hintUsed;
      const timeSpent = evidence.timeSpentSeconds;
      const kind = evidence.kind;

      // Base previous values (0 if new)
      const prev = previous ?? emptyState(evidence.studentId, evidence.conceptId ?? "unknown", now);

      // Alpha depends on evidence count and hint usage
      const isFirst = prev.evidenceCount === 0;
      let alpha = isFirst ? 0.5 : 0.3;
      if (hintUsed) alpha *= 0.5; // hints halve learning signal

      // --- knowledge: direct understanding ---
      // Correct without hint => strong gain; partial => medium; incorrect => small decay
      const knowledgeTarget = score;
      const knowledge = ema(prev.knowledge, knowledgeTarget, alpha);

      // --- retrieval: ability to recall under assessment ---
      // Weighted higher for quiz/recall evidence; lower for passive answer
      const retrievalKindFactor =
        kind === "recall_result" ? 1.0 : kind === "quiz_result" ? 0.9 : kind === "answer" ? 0.8 : 0.6;
      const retrievalAlpha = alpha * retrievalKindFactor;
      const retrieval = ema(prev.retrieval, score, retrievalAlpha);

      // --- retention: stability over time ---
      // If gap since last evidence > 7 days, retention decays before update
      const daysSinceLast = prev.lastEvidenceAt
        ? (Date.now() - new Date(prev.lastEvidenceAt).getTime()) / (1000 * 60 * 60 * 24)
        : 0;
      const decayFactor = daysSinceLast > 7 ? Math.max(0.7, 1 - (daysSinceLast - 7) * 0.02) : 1;
      const retentionBefore = prev.retention * decayFactor;
      const retention = ema(retentionBefore, retrieval, 0.25);

      // --- transfer: applying to new, unfamiliar problems ---
      const isTransferKind = kind === "transfer_result" || kind === "solution" || kind === "code";
      const transferAlpha = isTransferKind ? alpha * 1.0 : alpha * 0.2;
      // Transfer only improves meaningfully on transfer evidence; otherwise slight drift toward retrieval
      const transferTarget = isTransferKind ? score : prev.transfer * 0.95 + retrieval * 0.05;
      const transfer = ema(prev.transfer, transferTarget, transferAlpha);

      // --- fluency: speed + accuracy ---
      // Fast correct => high fluency; slow correct => medium; incorrect => low
      let fluencyTarget = 0;
      if (score >= 0.9) {
        if (timeSpent !== null && timeSpent !== undefined) {
          if (timeSpent <= 90) fluencyTarget = 1.0;
          else if (timeSpent <= 180) fluencyTarget = 0.7;
          else fluencyTarget = 0.5;
        } else {
          fluencyTarget = 0.7;
        }
      } else if (score >= 0.5) {
        fluencyTarget = 0.4;
      } else {
        fluencyTarget = 0.1;
      }
      const fluency = ema(prev.fluency, fluencyTarget, isTransferKind ? 0.35 : 0.25);

      // --- confidence: alignment of performance and self-assessment ---
      // Use score as proxy for demonstrated confidence; move slowly
      const confidence = ema(prev.confidence, score, 0.25);

      // --- hintDependency ---
      let hintDependency: number;
      if (hintUsed) hintDependency = clamp01(prev.hintDependency + 0.2 + (evidence.hintCount > 1 ? 0.1 : 0));
      else hintDependency = clamp01(prev.hintDependency - 0.08);
      // If multiple attempts required, dependency increases slightly even without hint
      if ((evidence.attemptCount ?? 1) > 2 && !hintUsed) hintDependency = clamp01(hintDependency + 0.05);

      // --- misconceptionRisk ---
      // High when repeated incorrect without improvement, or when correct follows hint-heavily
      let misconceptionRisk = prev.misconceptionRisk;
      if (score < 0.5 && prev.evidenceCount >= 2 && prev.knowledge > 0.5) {
        // Knowledge was medium-high but recent evidence incorrect => possible misconception
        misconceptionRisk = clamp01(misconceptionRisk + 0.25);
      } else if (score < 0.5 && (evidence.attemptCount ?? 1) > 1) {
        misconceptionRisk = clamp01(misconceptionRisk + 0.15);
      } else if (score >= 0.9 && !hintUsed) {
        misconceptionRisk = clamp01(misconceptionRisk - 0.15);
      } else if (score >= 0.5) {
        misconceptionRisk = clamp01(misconceptionRisk - 0.05);
      }
      // Hinted correct does not reduce misconception risk much
      if (hintUsed && score >= 0.9) misconceptionRisk = clamp01(misconceptionRisk + 0.05);

      const next: ConceptState = {
        conceptId: evidence.conceptId ?? prev.conceptId,
        studentId: evidence.studentId,
        knowledge,
        retrieval,
        retention,
        transfer,
        fluency,
        confidence,
        hintDependency,
        misconceptionRisk,
        evidenceCount: prev.evidenceCount + 1,
        lastEvidenceAt: now,
        stateVersion: prev.stateVersion + 1,
        createdAt: prev.createdAt,
        updatedAt: now,
      };

      const reason = `score=${score.toFixed(2)} kind=${kind} hint=${hintUsed} evidenceCount=${next.evidenceCount}`;

      return {
        next,
        update: {
          conceptId: next.conceptId,
          studentId: next.studentId,
          previous: previous,
          next,
          evidenceId: evidence.id,
          reason,
          updatedAt: now,
        },
      };
    },
  };
}

function emptyState(studentId: string, conceptId: string, nowIso: string): ConceptState {
  return {
    conceptId,
    studentId,
    knowledge: 0,
    retrieval: 0,
    retention: 0,
    transfer: 0,
    fluency: 0,
    confidence: 0.5, // neutral until evidence
    hintDependency: 0,
    misconceptionRisk: 0,
    evidenceCount: 0,
    lastEvidenceAt: null,
    stateVersion: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export const masteryEngine = createMasteryEngine();
