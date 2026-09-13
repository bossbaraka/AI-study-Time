/**
 * Learning domain services: resources, active recall, tests, mastery.
 */

import { clone, mockRequest } from "@/lib/api/client";
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
    return mockRequest(() => clone(db.recallCards.filter((c) => c.dueToday)), signal);
  },

  stats(signal?: AbortSignal): Promise<RecallSessionStats> {
    return mockRequest(() => clone(db.recallStats), signal);
  },

  /** Record an answer + self-rated confidence; the scheduler adjusts intervals. */
  answer(
    cardId: string,
    confidence: ConfidenceLevel,
    signal?: AbortSignal,
  ): Promise<{ card: RecallCard; stats: RecallSessionStats }> {
    return mockRequest(() => {
      const index = db.recallCards.findIndex((c) => c.id === cardId);
      if (index === -1) throw new Error(`Unknown recall card: ${cardId}`);
      const card = db.recallCards[index]!;

      const factor = confidence === "high" ? 2.2 : confidence === "medium" ? 1.4 : 0.6;
      const updated: RecallCard = {
        ...card,
        lastConfidence: confidence,
        intervalDays: Math.max(1, Math.round(card.intervalDays * factor)),
        dueToday: false,
      };
      db.recallCards[index] = updated;

      db.recallStats = {
        ...db.recallStats,
        dueToday: Math.max(0, db.recallStats.dueToday - 1),
        completedToday: db.recallStats.completedToday + 1,
        averageConfidence: clampPercent(
          (db.recallStats.averageConfidence * 3 + confidenceToPercent(confidence)) / 4,
        ),
      };
      return { card: clone(updated), stats: clone(db.recallStats) };
    }, signal);
  },
};

function confidenceToPercent(confidence: ConfidenceLevel): number {
  return confidence === "high" ? 90 : confidence === "medium" ? 65 : 35;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

export const testService = {
  list(signal?: AbortSignal): Promise<Test[]> {
    return mockRequest(() => clone(db.tests), signal);
  },

  get(id: string, signal?: AbortSignal): Promise<Test> {
    return mockRequest(() => {
      const test = db.tests.find((t) => t.id === id);
      if (!test) throw new Error(`Unknown test: ${id}`);
      return clone(test);
    }, signal);
  },

  results(signal?: AbortSignal): Promise<TestResult[]> {
    return mockRequest(() => clone(db.testResults), signal);
  },

  /**
   * Grade and persist a submission. Grading logic lives in the service layer —
   * the real implementation will be server-side; the contract is identical.
   */
  submit(
    testId: string,
    answers: TestResultAnswer[],
    timeSpentSeconds: number,
    signal?: AbortSignal,
  ): Promise<TestResult> {
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
      for (const question of test.questions) {
        const entry = topicScores.get(question.topic) ?? { correct: 0, total: 0 };
        entry.total += 1;
        if (answers.find((a) => a.questionId === question.id)?.correct) entry.correct += 1;
        topicScores.set(question.topic, entry);
      }

      const strongTopics = [...topicScores.entries()]
        .filter(([, v]) => v.total > 0 && v.correct === v.total)
        .map(([topic]) => topic);
      const needsReviewTopics = [...topicScores.entries()]
        .filter(([, v]) => v.correct < v.total)
        .map(([topic]) => topic);

      const recommendation: TestResult["recommendation"] =
        score >= 80
          ? "continue"
          : score >= 65
            ? "review-then-continue"
            : "recovery-session";

      const recommendationReason =
        recommendation === "continue"
          ? "All mastery signals agree — proceed to the next module."
          : recommendation === "review-then-continue"
            ? `Incorrect answers cluster around: ${needsReviewTopics.join(", ") || "—"}."`
            : `Your incorrect answers share a root cause in ${needsReviewTopics.join(" and ") || "this module"}. A structured recovery plan repairs it faster than retaking the test.`;

      const result: TestResult = {
        testId,
        score,
        submittedAt: new Date().toISOString(),
        timeSpentSeconds,
        answers,
        strongTopics,
        needsReviewTopics,
        recommendation,
        recommendationReason:
          recommendation === "review-then-continue"
            ? `Incorrect answers cluster around: ${needsReviewTopics.join(", ") || "—"}.`
            : recommendationReason,
      };

      db.testResults = [result, ...db.testResults];
      db.tests = db.tests.map((t) => (t.id === testId ? { ...t, status: "submitted" } : t));
      return clone(result);
    }, signal);
  },
};

export const masteryService = {
  list(signal?: AbortSignal): Promise<ModuleMastery[]> {
    return mockRequest(() => clone(db.mastery), signal);
  },
};
