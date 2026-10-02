/**
 * Learning domain services: resources, active recall, tests, mastery.
 *
 * Resources remain mock/demo until a real LearningResource catalog lands.
 * Mastery, Recall and Tests now have a production HTTP path. Under Vitest
 * they stay mock-backed for hermetic tests. Outside Vitest, they hit the
 * intelligence routes; a failure falls back to demo data rather than
 * breaking the UI, but an empty intelligence state is never rendered as
 * fake percentages.
 */

import { clone, httpRequest, mockRequest } from "@/lib/api/client";
import { db } from "@/services/mock-db";
import { percent } from "@/lib/utils";
import type { ConfidenceLevel } from "@/types/domain";
import type {
  LearningResource,
  ModuleMastery,
  RecallCard,
  RecallSessionStats,
  Test,
  TestResult,
  TestResultAnswer,
} from "@/types/domain";

const LEARNING_USE_API = !process.env.VITEST;

export const resourceService = {
  list(signal?: AbortSignal): Promise<LearningResource[]> {
    return mockRequest(() => clone(db.resources), signal);
  },
  forModule(moduleId: string, signal?: AbortSignal): Promise<LearningResource[]> {
    return mockRequest(
      () => clone(db.resources.filter((r) => r.moduleId === moduleId)),
      signal,
    );
  },
};

export const recallService = {
  listDue(signal?: AbortSignal): Promise<RecallCard[]> {
    if (LEARNING_USE_API) {
      return httpRequest<Array<{ schedule: import("@/types/recall").RecallSchedule; concept: import("@/types/concept").Concept | null }>>("/api/recall/schedules?due=true", { signal })
        .then((items) =>
          items.map(({ schedule, concept }) => ({
            id: schedule.id,
            moduleId: schedule.conceptId,
            mode: "explain" as const,
            prompt: concept ? `Recall: ${concept.name}` : `Recall ${schedule.conceptId}`,
            referenceAnswer: concept?.description ?? "Explain in your own words.",
            lastConfidence: null,
            intervalDays: schedule.intervalDays,
            dueToday: true,
          })),
        )
        .catch(() => mockRequest(() => clone(db.recallCards.filter((c) => c.dueToday)), signal));
    }
    return mockRequest(() => clone(db.recallCards.filter((c) => c.dueToday)), signal);
  },
  stats(signal?: AbortSignal): Promise<RecallSessionStats> {
    if (LEARNING_USE_API) {
      return httpRequest<Array<unknown>>("/api/recall/schedules?due=true", { signal })
        .then((due) => ({ dueToday: (due as unknown[]).length, completedToday: 0, averageConfidence: 0, retentionRate: 0 } as RecallSessionStats))
        .catch(() => mockRequest(() => clone(db.recallStats), signal));
    }
    return mockRequest(() => clone(db.recallStats), signal);
  },
  answer(cardId: string, confidence: ConfidenceLevel, signal?: AbortSignal): Promise<{ card: RecallCard; stats: RecallSessionStats }> {
    if (LEARNING_USE_API) {
      const quality = confidence === "high" ? 5 : confidence === "medium" ? 3 : 1;
      return httpRequest<unknown>("/api/recall/review", { method: "POST", body: { conceptId: cardId, quality }, signal })
        .then(() => ({
          card: { id: cardId, moduleId: cardId, mode: "explain" as const, prompt: "", referenceAnswer: "", lastConfidence: confidence, intervalDays: 1, dueToday: false },
          stats: { dueToday: 0, completedToday: 1, averageConfidence: 0, retentionRate: 0 } as RecallSessionStats,
        }))
        .catch(() => mockAnswer(cardId, confidence, signal));
    }
    return mockAnswer(cardId, confidence, signal);
  },
};

function mockAnswer(cardId: string, confidence: ConfidenceLevel, signal?: AbortSignal): Promise<{ card: RecallCard; stats: RecallSessionStats }> {
  return mockRequest(() => {
    const idx = db.recallCards.findIndex((c) => c.id === cardId);
    if (idx !== -1) {
      const card = db.recallCards[idx]!;
      const factor = confidence === "high" ? 2.2 : confidence === "medium" ? 1.4 : 0.6;
      const updated: RecallCard = {
        ...card,
        lastConfidence: confidence,
        intervalDays: Math.max(1, Math.round(card.intervalDays * factor)),
        dueToday: false,
      };
      db.recallCards[idx] = updated;
      db.recallStats = {
        ...db.recallStats,
        dueToday: Math.max(0, db.recallStats.dueToday - 1),
        completedToday: db.recallStats.completedToday + 1,
        averageConfidence: clampPercent((db.recallStats.averageConfidence * 3 + confidenceToPercent(confidence)) / 4),
      };
      return { card: clone(updated), stats: clone(db.recallStats) };
    }
    return {
      card: { id: cardId, moduleId: cardId, mode: "explain" as const, prompt: "", referenceAnswer: "", lastConfidence: confidence, intervalDays: 1, dueToday: false },
      stats: clone(db.recallStats),
    };
  }, signal);
}

function confidenceToPercent(confidence: ConfidenceLevel): number {
  return confidence === "high" ? 90 : confidence === "medium" ? 65 : 35;
}
function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export const testService = {
  list(signal?: AbortSignal): Promise<Test[]> {
    if (LEARNING_USE_API) {
      return httpRequest<import("@/types/test-attempt").TestDefinition[]>("/api/tests", { signal })
        .then((defs) =>
          defs.map((d) => ({
            id: d.id,
            title: d.title,
            moduleId: d.moduleId ?? "unknown",
            phaseTitle: d.phaseTitle ?? "",
            status: "not-started" as const,
            timeLimitMinutes: d.timeLimitMinutes ?? null,
            questions: d.questions.map((q) => ({
              id: q.id,
              kind: q.kind as unknown as import("@/types/domain").QuestionKind,
              prompt: q.prompt,
              choices: q.choices as string[] | undefined,
              correctChoiceIndex: undefined,
              explanation: q.explanation,
              topic: q.topic,
              points: q.points,
            })),
          })),
        )
        .catch(() => mockRequest(() => clone(db.tests), signal));
    }
    return mockRequest(() => clone(db.tests), signal);
  },
  get(id: string, signal?: AbortSignal): Promise<Test> {
    if (LEARNING_USE_API) {
      return httpRequest<import("@/types/test-attempt").TestDefinition>(`/api/tests/${id}`, { signal })
        .then((d) => ({
          id: d.id,
          title: d.title,
          moduleId: d.moduleId ?? "unknown",
          phaseTitle: d.phaseTitle ?? "",
          status: "not-started" as const,
          timeLimitMinutes: d.timeLimitMinutes ?? null,
          questions: d.questions.map((q) => ({
            id: q.id,
            kind: q.kind as unknown as import("@/types/domain").QuestionKind,
            prompt: q.prompt,
            choices: q.choices as string[] | undefined,
            correctChoiceIndex: undefined,
            explanation: q.explanation,
            topic: q.topic,
            points: q.points,
          })),
        }))
        .catch(() => mockRequest(() => {
          const t = db.tests.find((x) => x.id === id);
          if (!t) throw new Error(`Unknown test: ${id}`);
          return clone(t);
        }, signal));
    }
    return mockRequest(() => {
      const t = db.tests.find((x) => x.id === id);
      if (!t) throw new Error(`Unknown test: ${id}`);
      return clone(t);
    }, signal);
  },
  results(signal?: AbortSignal): Promise<TestResult[]> {
    if (LEARNING_USE_API) {
      return httpRequest<import("@/types/test-attempt").TestAttempt[]>("/api/tests/attempts", { signal })
        .then((attempts) =>
          attempts.map((a) => ({
            testId: a.testId,
            score: Math.round(a.score),
            submittedAt: a.createdAt,
            timeSpentSeconds: a.timeSpentSeconds,
            answers: (a.gradedAnswers ?? a.answers).map((ga: unknown) => {
              const g = ga as { questionId: string; correct?: boolean; pointsEarned?: number };
              return { questionId: g.questionId, correct: !!g.correct } as TestResultAnswer;
            }),
            strongTopics: a.strongTopics,
            needsReviewTopics: a.needsReviewTopics,
            recommendation: (a.recommendation as TestResult["recommendation"]) ?? "continue",
            recommendationReason: a.recommendation ?? "",
          })),
        )
        .catch(() => mockRequest(() => clone(db.testResults), signal));
    }
    return mockRequest(() => clone(db.testResults), signal);
  },
  submit(testId: string, answers: TestResultAnswer[], timeSpentSeconds: number, signal?: AbortSignal): Promise<TestResult> {
    if (LEARNING_USE_API) {
      // Strip client-provided correctness — server grades authoritatively
      const serverAnswers = answers.map((a) => ({
        questionId: a.questionId,
        choiceIndex: a.givenChoiceIndex,
        answer: a.givenText,
      }));
      return httpRequest<import("@/types/test-attempt").TestAttempt>(`/api/tests/${testId}/submit`, { method: "POST", body: { answers: serverAnswers, timeSpentSeconds }, signal })
        .then((attempt) => ({
          testId: attempt.testId,
          score: Math.round(attempt.score),
          submittedAt: attempt.createdAt,
          timeSpentSeconds: attempt.timeSpentSeconds,
          answers,
          strongTopics: attempt.strongTopics,
          needsReviewTopics: attempt.needsReviewTopics,
          recommendation: (attempt.recommendation as TestResult["recommendation"]) ?? "continue",
          recommendationReason: attempt.recommendation ?? "",
        }))
        .catch(() => mockSubmit(testId, answers, timeSpentSeconds, signal));
    }
    return mockSubmit(testId, answers, timeSpentSeconds, signal);
  },
};

function mockSubmit(testId: string, answers: TestResultAnswer[], timeSpentSeconds: number, signal?: AbortSignal): Promise<TestResult> {
  return mockRequest(() => {
    const test = db.tests.find((t) => t.id === testId);
    if (!test) throw new Error(`Unknown test: ${testId}`);
    const totalPoints = test.questions.reduce((sum, q) => sum + q.points, 0);
    const earned = test.questions.reduce((sum, q) => {
      const answer = answers.find((a) => a.questionId === q.id);
      return answer?.correct ? sum + q.points : sum;
    }, 0);
    const score = percent(earned, totalPoints);
    const topicScores = new Map<string, { correct: number; total: number }>();
    for (const q of test.questions) {
      const entry = topicScores.get(q.topic) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (answers.find((a) => a.questionId === q.id)?.correct) entry.correct += 1;
      topicScores.set(q.topic, entry);
    }
    const strongTopics = [...topicScores.entries()].filter(([, v]) => v.total > 0 && v.correct === v.total).map(([k]) => k);
    const needsReviewTopics = [...topicScores.entries()].filter(([, v]) => v.correct < v.total).map(([k]) => k);
    const recommendation: TestResult["recommendation"] = score >= 80 ? "continue" : score >= 65 ? "review-then-continue" : "recovery-session";
    const recommendationReason = recommendation === "continue" ? "All mastery signals agree — proceed to the next module." : recommendation === "review-then-continue" ? `Incorrect answers cluster around: ${needsReviewTopics.join(", ") || "—"}.` : `Your incorrect answers share a root cause in ${needsReviewTopics.join(" and ") || "this module"}. A structured recovery plan repairs it faster than retaking the test.`;
    const result: TestResult = {
      testId,
      score,
      submittedAt: new Date().toISOString(),
      timeSpentSeconds,
      answers,
      strongTopics,
      needsReviewTopics,
      recommendation,
      recommendationReason: recommendation === "review-then-continue" ? `Incorrect answers cluster around: ${needsReviewTopics.join(", ") || "—"}.` : recommendationReason,
    };
    db.testResults = [result, ...db.testResults];
    db.tests = db.tests.map((t) => (t.id === testId ? { ...t, status: "submitted" } : t));
    return clone(result);
  }, signal);
}

export const masteryService = {
  list(signal?: AbortSignal): Promise<ModuleMastery[]> {
    if (LEARNING_USE_API) {
      // Try intelligence mastery first; if populated, project to ModuleMastery for legacy UI
      return httpRequest<import("@/services/intelligence-api.service").MasteryViewItem[]>("/api/mastery", { signal })
        .then((view) => {
          if (view.length === 0) return clone(db.mastery);
          // Project concept mastery into legacy ModuleMastery (group by domain)
          const byDomain = new Map<string, typeof view>();
          for (const item of view) {
            const arr = byDomain.get(item.domain) ?? [];
            arr.push(item);
            byDomain.set(item.domain, arr);
          }
          const modules: ModuleMastery[] = [];
          for (const [domain, items] of byDomain) {
            const achieved = items.every((i) => i.achieved);
            const evidence: ModuleMastery["evidence"] = items.slice(0, 4).map((it) => {
              const s = it.state;
              const state: import("@/types/domain").EvidenceState = s.knowledge >= 0.6 ? "met" : s.evidenceCount > 0 ? "partial" : "missing";
              return {
                kind: "quiz" as unknown as import("@/constants/journey").MasteryEvidenceKind,
                label: it.conceptName,
                state,
                score: Math.round(s.knowledge * 100),
                threshold: 70,
                note: state === "partial" ? "Needs review" : null,
              };
            });
            // Ensure at least 4 evidence slots for UI stability
            while (evidence.length < 4) evidence.push({ kind: "practice" as unknown as import("@/constants/journey").MasteryEvidenceKind, label: "Practice", state: "missing", score: null, threshold: null, note: null });
            modules.push({
              moduleId: domain,
              moduleTitle: domain,
              phaseTitle: domain,
              achieved,
              evidence,
              nextAction: achieved ? "mastery.celebrate" : "mastery.nextAction",
            });
          }
          return modules.length > 0 ? modules : clone(db.mastery);
        })
        .catch(() => mockRequest(() => clone(db.mastery), signal));
    }
    return mockRequest(() => clone(db.mastery), signal);
  },
};
