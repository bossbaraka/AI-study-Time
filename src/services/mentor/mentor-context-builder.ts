/**
 * Mentor Context Builder — real learner context, not hallucination.
 *
 * Assembles:
 *   Student, Goal, Roadmap, Current Unit, ConceptStates, Recent Evidence,
 *   Misconceptions, Recent failures, Learning behavior, Current adaptive
 *   recommendation, Previous mentor interactions.
 *
 * The LLM is only responsible for explanation/dialogue/examples/
 * rephrasing/Socratic questioning/feedback wording. Truth lives in DB.
 */

import type { ConceptState } from "@/types/concept-state";
import type { LearningEvent } from "@/types/learning-event";
import type { Evidence } from "@/types/evidence";
import type { AdaptiveDecision } from "@/types/adaptive";

export interface MentorContext {
  studentId: string;
  goalTitle: string | null;
  roadmapTitle: string | null;
  currentUnitTitle: string | null;
  conceptStatesSummary: Array<{
    conceptId: string;
    knowledge: number;
    retrieval: number;
    misconceptionRisk: number;
    evidenceCount: number;
  }>;
  weakConcepts: string[];
  strongConcepts: string[];
  recentEvidence: Array<{ conceptId: string | null; kind: string; score: number | null; at: string }>;
  misconceptions: string[];
  recentFailures: string[];
  behavior: { consistency: number; hintDependencyRate: number; streakDays?: number };
  adaptiveRecommendation: AdaptiveDecision | null;
  eventCount: number;
}

export function buildMentorContext(params: {
  studentId: string;
  goalTitle?: string | null;
  roadmapTitle?: string | null;
  currentUnitTitle?: string | null;
  conceptStates: ConceptState[];
  recentEvidence: Evidence[];
  recentEvents: LearningEvent[];
  adaptiveDecision: AdaptiveDecision | null;
}): MentorContext {
  const weakConcepts = params.conceptStates.filter((s) => s.knowledge < 0.4 && s.evidenceCount > 0).map((s) => s.conceptId);
  const strongConcepts = params.conceptStates.filter((s) => s.knowledge >= 0.7).map((s) => s.conceptId);
  const misconceptions = params.conceptStates.filter((s) => s.misconceptionRisk >= 0.5).map((s) => s.conceptId);
  const recentFailures = params.recentEvidence.filter((e) => (e.score ?? 1) < 0.5).map((e) => e.conceptId ?? e.kind);

  const hintEvents = params.recentEvents.filter((e) => e.type === "HINT_REQUESTED").length;
  const evidenceEvents = params.recentEvents.filter((e) => e.type === "EVIDENCE_SUBMITTED").length || 1;
  const hintDependencyRate = Math.min(100, Math.round((hintEvents / evidenceEvents) * 100));

  // Consistency last 14 days
  const dayMs = 24 * 60 * 60 * 1000;
  const last14 = params.recentEvents.filter((e) => Date.now() - new Date(e.timestamp).getTime() <= 14 * dayMs);
  const days = new Set(last14.map((e) => new Date(e.timestamp).toISOString().slice(0, 10)));
  const consistency = Math.round((days.size / 14) * 100);

  return {
    studentId: params.studentId,
    goalTitle: params.goalTitle ?? null,
    roadmapTitle: params.roadmapTitle ?? null,
    currentUnitTitle: params.currentUnitTitle ?? null,
    conceptStatesSummary: params.conceptStates.map((s) => ({
      conceptId: s.conceptId,
      knowledge: s.knowledge,
      retrieval: s.retrieval,
      misconceptionRisk: s.misconceptionRisk,
      evidenceCount: s.evidenceCount,
    })),
    weakConcepts,
    strongConcepts,
    recentEvidence: params.recentEvidence.slice(0, 5).map((e) => ({
      conceptId: e.conceptId,
      kind: e.kind,
      score: e.score,
      at: e.createdAt,
    })),
    misconceptions,
    recentFailures,
    behavior: { consistency, hintDependencyRate },
    adaptiveRecommendation: params.adaptiveDecision,
    eventCount: params.recentEvents.length,
  };
}

export interface MentorPolicyCheck {
  allowed: boolean;
  reason?: string;
}

/**
 * Mentor safety: the mentor must not hallucinate, change goal/mastery/verdict,
 * or invent history. If no data, answer is "unknown" not hallucinated.
 */
export function validateMentorResponse(context: MentorContext, response: string): MentorPolicyCheck {
  // Block disallowed claims (simple heuristic; structured validation would be stronger)
  const lower = response.toLowerCase();
  if (lower.includes("your mastery is") && context.conceptStatesSummary.length === 0) {
    return { allowed: false, reason: "Mentor claims mastery with no evidence." };
  }
  if (lower.includes("you scored") && context.recentEvidence.length === 0) {
    return { allowed: false, reason: "Mentor claims a score with no evidence." };
  }
  // If response tries to change goal/roadmap directly, block
  if (lower.includes("i have updated your goal") || lower.includes("i changed your roadmap")) {
    return { allowed: false, reason: "Mentor must not directly mutate goal/roadmap." };
  }
  return { allowed: true };
}

export function createMentorContextBuilder() {
  return { build: buildMentorContext, validate: validateMentorResponse };
}
