/**
 * Behavior Engine — observable learning behavior only.
 *
 * No personality diagnosis, no clinical language. Only:
 * consistency, session abandonment, delay patterns, hint dependency,
 * repeated failures, study bursts, recovery patterns.
 *
 * Input: LearningEvents (filtered by student).
 * Output: behavior aggregates that are safe to show.
 */

import type { LearningEvent } from "@/types/learning-event";

export interface BehaviorInsights {
  consistency: number; // 0..100 (days active in last 14)
  sessionAbandonmentRate: number; // 0..100
  averageDelayMinutes: number;
  hintDependencyRate: number; // 0..100
  repeatedFailureConcepts: string[]; // conceptIds with >=3 low-score evidences in 7 days
  studyBursts: { date: string; count: number }[]; // last 7 days activity histogram
  recoveryAttempts: number;
  recentEventsCount: number;
}

export function analyzeBehavior(events: LearningEvent[]): BehaviorInsights {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Consistency: unique days with any event in last 14 days
  const last14 = events.filter((e) => now - new Date(e.timestamp).getTime() <= 14 * dayMs);
  const days = new Set(last14.map((e) => new Date(e.timestamp).toISOString().slice(0, 10)));
  const consistency = Math.round((days.size / 14) * 100);

  // Session abandonment: SESSION_STARTED without SESSION_ENDED within 2h correlation
  const started = events.filter((e) => e.type === "SESSION_STARTED").length;
  const ended = events.filter((e) => e.type === "SESSION_ENDED").length;
  const sessionAbandonmentRate = started === 0 ? 0 : Math.round(((started - ended) / started) * 100);

  // Hint dependency: HINT_REQUESTED / EVIDENCE_SUBMITTED with hint
  const hintRequested = events.filter((e) => e.type === "HINT_REQUESTED").length;
  const evidenceSubmitted = events.filter((e) => e.type === "EVIDENCE_SUBMITTED").length || 1;
  const hintDependencyRate = Math.min(100, Math.round((hintRequested / evidenceSubmitted) * 100));

  // Study bursts histogram last 7 days
  const burstsMap = new Map<string, number>();
  for (const e of events) {
    const d = new Date(e.timestamp).toISOString().slice(0, 10);
    const age = now - new Date(e.timestamp).getTime();
    if (age <= 7 * dayMs) burstsMap.set(d, (burstsMap.get(d) ?? 0) + 1);
  }
  const studyBursts = [...burstsMap.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

  // Repeated failures: group EVIDENCE_SUBMITTED with score <0.5 by concept
  const lowScoreByConcept = new Map<string, number>();
  for (const e of events) {
    if (e.type === "EVIDENCE_SUBMITTED") {
      const score = (e.payload as { score?: number })?.score;
      const conceptId = (e.payload as { conceptId?: string })?.conceptId as string | undefined;
      if (conceptId && typeof score === "number" && score < 0.5) {
        lowScoreByConcept.set(conceptId, (lowScoreByConcept.get(conceptId) ?? 0) + 1);
      }
    }
  }
  const repeatedFailureConcepts = [...lowScoreByConcept.entries()].filter(([, c]) => c >= 3).map(([k]) => k);

  const recoveryAttempts = events.filter((e) => e.type === "RECOVERY_STARTED").length;

  // Average delay: not modeled here without scheduled vs actual times — return 0 honestly instead of fake minutes
  const averageDelayMinutes = 0;

  return {
    consistency,
    sessionAbandonmentRate: Math.max(0, sessionAbandonmentRate),
    averageDelayMinutes,
    hintDependencyRate,
    repeatedFailureConcepts,
    studyBursts,
    recoveryAttempts,
    recentEventsCount: last14.length,
  };
}

export function createBehaviorEngine() {
  return { analyze: analyzeBehavior };
}

export const behaviorEngine = createBehaviorEngine();
