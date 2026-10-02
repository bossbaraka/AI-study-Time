/**
 * Test Grading Engine — server-authoritative.
 *
 * The browser submits answers (choiceIndex / answer text). The server
 * grades against the stored rubric/correctChoiceIndex and produces
 * correctness, score, feedback and concept mapping. No `correct: boolean`
 * from client is ever trusted.
 */

import type { TestDefinition, TestAnswerInput, GradedAnswer } from "@/types/test-attempt";

export interface GradingResult {
  graded: GradedAnswer[];
  score: number; // 0..100
  strongTopics: string[];
  needsReviewTopics: string[];
  recommendation: "continue" | "review-then-continue" | "recovery-session";
}

function gradeOne(
  question: TestDefinition["questions"][number],
  answer: TestAnswerInput | undefined,
): GradedAnswer {
  const pointsPossible = question.points;
  const topic = question.topic;

  if (question.kind === "multiple_choice" || question.kind === "scenario") {
    const given = answer?.choiceIndex;
    const correct = given !== undefined && question.correctChoiceIndex !== null && question.correctChoiceIndex !== undefined
      ? given === question.correctChoiceIndex
      : false;
    return {
      questionId: question.id,
      givenChoiceIndex: given,
      correct,
      pointsEarned: correct ? pointsPossible : 0,
      pointsPossible,
      feedback: correct ? "Correct." : (question.explanation || "Review the concept."),
    };
  }

  // Short answer / problem solving — rubric keywords with minMatches
  const rubric = question.rubric as { keywords?: string[]; minMatches?: number } | undefined;
  const text = (answer?.answer ?? "").toLowerCase();
  if (rubric?.keywords && rubric.keywords.length > 0) {
    const min = rubric.minMatches ?? Math.ceil(rubric.keywords.length * 0.6);
    const matches = rubric.keywords.filter((k) => text.includes(k.toLowerCase())).length;
    const correct = matches >= min;
    const partial = matches >= 1;
    return {
      questionId: question.id,
      givenAnswer: answer?.answer,
      correct,
      pointsEarned: correct ? pointsPossible : partial ? Math.round(pointsPossible * 0.5) : 0,
      pointsPossible,
      feedback: correct ? "Well explained." : partial ? "Partial — missing key ideas." : (question.explanation || "Needs review."),
    };
  }

  // No rubric: require non-empty answer for credit; real tests should have rubrics
  const hasAnswer = (answer?.answer?.trim().length ?? 0) >= 10;
  return {
    questionId: question.id,
    givenAnswer: answer?.answer,
    correct: hasAnswer,
    pointsEarned: hasAnswer ? Math.round(pointsPossible * 0.5) : 0,
    pointsPossible,
    feedback: hasAnswer ? "Response recorded — review feedback." : "No answer provided.",
  };
}

export function gradeTest(definition: TestDefinition, answers: TestAnswerInput[], timeSpentSeconds: number): GradingResult {
  void timeSpentSeconds;
  const answerMap = new Map<string, TestAnswerInput>(answers.map((a) => [a.questionId, a]));
  const graded: GradedAnswer[] = [];
  let earned = 0;
  let total = 0;

  const topicStats = new Map<string, { correct: number; total: number }>();

  for (const q of definition.questions) {
    const g = gradeOne(q, answerMap.get(q.id));
    graded.push(g);
    earned += g.pointsEarned;
    total += g.pointsPossible;

    const stats = topicStats.get(q.topic) ?? { correct: 0, total: 0 };
    stats.total += 1;
    if (g.correct) stats.correct += 1;
    topicStats.set(q.topic, stats);
  }

  const score = total === 0 ? 0 : Math.round((earned / total) * 100);

  const strongTopics = [...topicStats.entries()].filter(([, v]) => v.total > 0 && v.correct === v.total).map(([k]) => k);
  const needsReviewTopics = [...topicStats.entries()].filter(([, v]) => v.correct < v.total).map(([k]) => k);

  const recommendation: GradingResult["recommendation"] =
    score >= 80 ? "continue" : score >= 65 ? "review-then-continue" : "recovery-session";

  return { graded, score, strongTopics, needsReviewTopics, recommendation };
}

export function createTestGradingEngine() {
  return { gradeTest };
}

export const testGradingEngine = createTestGradingEngine();
