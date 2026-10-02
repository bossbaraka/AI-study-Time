/**
 * Recall Engine — evidence-driven scheduling.
 *
 * Not `interval * {2.2,1.4,0.6}` on self-rated confidence alone.
 * Uses correctness (quality 0..5) derived from server-graded evidence
 * and an SM-2-like policy with deterministic, testable transitions.
 *
 * States: new → learning → review → (relearning on failure)
 * Quality mapping:
 *   5 = perfect recall, no hesitation
 *   4 = correct with moderate effort
 *   3 = correct with difficulty
 *   2 = incorrect but remembered after hint
 *   1 = incorrect, recognized answer
 *   0 = blackout
 */

import type { RecallSchedule, RecallReviewInput } from "@/types/recall";

function nowIso(): string { return new Date().toISOString(); }
function addDays(baseIso: string, days: number): string {
  const d = new Date(baseIso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}
function clamp(n: number, min: number, max: number): number { return Math.min(max, Math.max(min, n)); }

export interface RecallEngine {
  scheduleNew(studentId: string, conceptId: string, evidenceId?: string | null): RecallSchedule;
  review(schedule: RecallSchedule, input: RecallReviewInput): RecallSchedule;
  dueInDays(schedule: RecallSchedule, nowIso?: string): number;
}

export function createRecallEngine(): RecallEngine {
  return {
    scheduleNew(studentId, conceptId, evidenceId = null) {
      const now = nowIso();
      return {
        id: `rs_${conceptId}_${studentId}`.slice(0, 48),
        studentId,
        conceptId,
        evidenceId,
        intervalDays: 1,
        easeFactor: 2.5,
        repetitions: 0,
        dueAt: addDays(now, 1),
        lastReviewedAt: null,
        state: "new",
        createdAt: now,
        updatedAt: now,
      };
    },

    review(schedule, input) {
      const quality = clamp(Math.round(input.quality), 0, 5);
      const wasCorrect = quality >= 3;
      const now = nowIso();
      let { intervalDays, easeFactor, repetitions, state } = schedule;

      // Ease update (SM-2)
      easeFactor = clamp(easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)), 1.3, 2.8);

      if (quality < 3) {
        // Failure: lapse
        repetitions = 0;
        intervalDays = 1;
        state = "relearning";
      } else {
        // Success
        repetitions += 1;
        if (state === "new" || state === "learning") {
          intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.round(intervalDays * easeFactor);
          state = repetitions >= 2 ? "review" : "learning";
        } else if (state === "review" || state === "relearning") {
          intervalDays = Math.round(intervalDays * easeFactor);
          state = "review";
        }
        // Cap interval for safety in this phase; long intervals come later with more evidence
        intervalDays = clamp(intervalDays, 1, 90);
      }

      const dueAt = addDays(now, intervalDays);

      return {
        ...schedule,
        intervalDays,
        easeFactor,
        repetitions,
        dueAt,
        lastReviewedAt: now,
        state,
        updatedAt: now,
      };
    },

    dueInDays(schedule, nowIsoArg) {
      const now = new Date(nowIsoArg ?? nowIso()).getTime();
      const due = new Date(schedule.dueAt).getTime();
      return Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    },
  };
}

export const recallEngine = createRecallEngine();
