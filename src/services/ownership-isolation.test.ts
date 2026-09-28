/**
 * Cross-student isolation — the security regression suite for Phase 1.
 *
 * Two defects are pinned here:
 *
 * 1. **Assessment sessions had no owner.** Every session lived under one
 *    shared key, so on a shared device student B resumed student A's
 *    session and inherited A's diagnosis. Sessions are now bound to a
 *    `studentId` resolved server-side from the authenticated session.
 *
 * 2. **The AI answer key reached the browser.** `/api/assessment/generate`
 *    returned the whole generated bank — `correctOptionId`, keyword lists,
 *    match thresholds. The bank now stays on the stored session and only
 *    the public question projection leaves the engine.
 *
 * Every negative case here is a *regression* test: if ownership ever
 * regresses to a shared store or a client-trusted id, these fail.
 */

import { beforeEach, describe, expect, it } from "vitest";
import {
  mockAssessmentEngine,
  mockExecutionEngine,
  mockGoalEngine,
  mockRoadmapEngine,
} from "@/services/engines";
import type { BankItem } from "@/services/assessment/question-bank";
import type { AssessmentResult, AssessmentSession, SubmitAnswerPayload } from "@/types/assessment";
import type { GoalDiscoveryInput } from "@/types/goal";

const STUDENT_A = "student_a";
const STUDENT_B = "student_b";

function jsInput(): GoalDiscoveryInput {
  return {
    targetDomain: { kind: "preset", presetId: "javascript" },
    desiredOutcome: "Build and deploy two practical JavaScript apps with tests and clean code",
    motivation: { kind: "career" },
    currentLevel: "developing",
    targetLevel: "build_independently",
    timeframe: { weeks: 24, preset: true },
    weeklyCommitment: { hoursPerWeek: 7, preset: true },
    constraints: [],
  };
}

/** A locked goal + active roadmap owned by `studentId`. */
function roadmapFor(studentId: string, key: string) {
  const { goal } = mockGoalEngine.createGoal(jsInput(), {
    studentId,
    idempotencyKey: `key-${key}`,
    diagnosisContext: null,
  });
  const locked = mockGoalEngine.lockGoal(goal.id, studentId, `lock-${key}`);
  return { goal: locked, roadmap: mockRoadmapEngine.generateRoadmap(locked.id, studentId).roadmap };
}

function answerFor(session: AssessmentSession, submissionId: string): SubmitAnswerPayload {
  const question = session.currentQuestion!;
  const firstOptionId = question.options?.[0]?.id ?? "a";
  const response =
    question.type === "multiple_choice" || question.type === "scenario"
      ? { type: question.type, questionId: question.id, optionId: firstOptionId }
      : { type: question.type, questionId: question.id, answer: "an answer" };
  return { sessionId: session.id, response, submissionId } as SubmitAnswerPayload;
}

/** Plays a session to completion so a diagnosis exists. */
function completedSession(studentId: string): AssessmentResult {
  let session = mockAssessmentEngine.createSession(studentId);
  for (let i = 0; i < 40 && session.status === "in_progress"; i += 1) {
    session = mockAssessmentEngine.submitAnswer(answerFor(session, `sub_${i}`), studentId);
  }
  if (session.status === "in_progress") {
    session = mockAssessmentEngine.completeSession(session.id, studentId);
  }
  return mockAssessmentEngine.getResults(session.id, studentId);
}

beforeEach(() => {
  mockAssessmentEngine.__reset();
  mockGoalEngine.__reset();
  mockRoadmapEngine.__reset();
  mockExecutionEngine.__reset();
});

describe("isolation — assessment sessions (§43.6)", () => {
  it("never hands student B student A's active session", () => {
    const a = mockAssessmentEngine.createSession(STUDENT_A);
    expect(mockAssessmentEngine.getActiveSession(STUDENT_A)?.id).toBe(a.id);
    expect(mockAssessmentEngine.getActiveSession(STUDENT_B)).toBeNull();
  });

  it("reads a foreign session as missing, not as forbidden", () => {
    const a = mockAssessmentEngine.createSession(STUDENT_A);
    // A 403 would confirm the id exists. Existence must not leak.
    expect(() => mockAssessmentEngine.getSession(a.id, STUDENT_B)).toThrow(
      expect.objectContaining({ status: 404, code: "session_not_found" }),
    );
  });

  it("rejects every mutating call from a non-owner", () => {
    const a = mockAssessmentEngine.createSession(STUDENT_A);
    const payload = answerFor(a, "sub_b");
    expect(() => mockAssessmentEngine.submitAnswer(payload, STUDENT_B)).toThrow(
      expect.objectContaining({ status: 404 }),
    );
    expect(() => mockAssessmentEngine.pauseSession(a.id, STUDENT_B)).toThrow(
      expect.objectContaining({ status: 404 }),
    );
    expect(() => mockAssessmentEngine.resumeSession(a.id, STUDENT_B)).toThrow(
      expect.objectContaining({ status: 404 }),
    );
    expect(() => mockAssessmentEngine.completeSession(a.id, STUDENT_B)).toThrow(
      expect.objectContaining({ status: 404 }),
    );
    expect(() => mockAssessmentEngine.getResults(a.id, STUDENT_B)).toThrow(
      expect.objectContaining({ status: 404 }),
    );
  });

  it("leaves the owner's session untouched by the rejected calls", () => {
    const a = mockAssessmentEngine.createSession(STUDENT_A);
    expect(() => mockAssessmentEngine.submitAnswer(answerFor(a, "sub_b"), STUDENT_B)).toThrow();
    const stillMine = mockAssessmentEngine.getSession(a.id, STUDENT_A);
    expect(stillMine.status).toBe("in_progress");
    expect(stillMine.progress.questionsAnswered).toBe(0);
  });

  it("never exposes student A's diagnosis as student B's latest result", () => {
    completedSession(STUDENT_A);
    expect(mockAssessmentEngine.getLatestCompletedResult(STUDENT_A)).not.toBeNull();
    expect(mockAssessmentEngine.getLatestCompletedResult(STUDENT_B)).toBeNull();
  });

  it("keeps two students' sessions distinct even for the same profile", () => {
    const profile = { targetSubject: "Biology", age: 16, stage: "high_school" as const };
    const a = mockAssessmentEngine.createSession(STUDENT_A, profile);
    const b = mockAssessmentEngine.createSession(STUDENT_B, profile);
    expect(a.id).not.toBe(b.id);
    // Each owner sees their own; neither sees the other's.
    expect(mockAssessmentEngine.getSession(a.id, STUDENT_A).id).toBe(a.id);
    expect(mockAssessmentEngine.getSession(b.id, STUDENT_B).id).toBe(b.id);
    expect(() => mockAssessmentEngine.getSession(b.id, STUDENT_A)).toThrow(
      expect.objectContaining({ status: 404 }),
    );
    expect(() => mockAssessmentEngine.getSession(a.id, STUDENT_B)).toThrow(
      expect.objectContaining({ status: 404 }),
    );
  });
});

describe("isolation — answer keys stay server-side (§43.7)", () => {
  const generatedBank: BankItem[] = [
    {
      question: {
        id: "gen_1",
        type: "multiple_choice",
        prompt: "Which closure keeps its counter private?",
        topic: "closures",
        difficulty: "foundational",
        estimatedSeconds: 50,
        options: [
          { id: "a", label: "A function returning a function over a local variable" },
          { id: "b", label: "A global counter variable" },
        ],
      },
      scoring: { kind: "option", correctOptionId: "a" },
    },
    {
      question: {
        id: "gen_2",
        type: "short_answer",
        prompt: "Explain what a closure keeps alive.",
        topic: "closures",
        difficulty: "intermediate",
        estimatedSeconds: 60,
      },
      scoring: { kind: "keywords", keywords: ["scope", "enclosing"], minMatches: 1 },
    },
  ];

  it("never puts scoring data on the projection the client receives", () => {
    const session = mockAssessmentEngine.createSession(STUDENT_A, undefined, {
      bank: generatedBank,
      topics: ["closures"],
    });
    const wire = JSON.stringify(session);
    expect(wire).not.toContain("correctOptionId");
    expect(wire).not.toContain("minMatches");
    expect(wire).not.toContain("keywords");
    expect(session.currentQuestion).not.toHaveProperty("scoring");
  });

  /**
   * Grades ONE wrong answer (option "b", key says "a") and finishes the
   * session with a correct keyword answer, then returns the diagnosis.
   * `extra` is whatever the client tries to smuggle into the payload.
   */
  function gradedWithExtra(extra: Record<string, unknown>): AssessmentResult {
    mockAssessmentEngine.__reset();
    let session = mockAssessmentEngine.createSession(STUDENT_A, undefined, {
      bank: generatedBank,
      topics: ["closures"],
    });
    session = mockAssessmentEngine.submitAnswer(
      {
        sessionId: session.id,
        response: {
          type: "multiple_choice",
          questionId: session.currentQuestion!.id,
          optionId: "b",
        },
        submissionId: "sub_wrong",
        ...extra,
      } as unknown as SubmitAnswerPayload,
      STUDENT_A,
    );
    for (let i = 0; i < 40 && session.status === "in_progress"; i += 1) {
      session = mockAssessmentEngine.submitAnswer(
        {
          sessionId: session.id,
          response: {
            type: "short_answer",
            questionId: session.currentQuestion!.id,
            answer: "the scope it was defined in stays enclosing the variable",
          },
          submissionId: `fin_${i}`,
        } as unknown as SubmitAnswerPayload,
        STUDENT_A,
      );
    }
    if (session.status === "in_progress") {
      mockAssessmentEngine.completeSession(session.id, STUDENT_A);
    }
    return mockAssessmentEngine.getResults(session.id, STUDENT_A);
  }

  it("keeps grading the server's job — the client cannot declare itself correct", () => {
    // Wrong answer + a smuggled `correct: true`.
    const result = gradedWithExtra({ correct: true, score: 100, isCorrect: true });

    // The engine graded it from its OWN key: the topic the student got
    // wrong lands in developingAreas, and is NOT reported as a strength.
    expect(result.developingAreas.map((d) => d.topic)).toContain("closures");
    expect(result.strengths.map((s) => s.topic)).not.toContain("closures");
    expect(JSON.stringify(result)).not.toContain('"correct":true');
  });

  it("grades the same submission identically regardless of any client verdict", () => {
    // Per-run fields only — everything graded must be byte-identical.
    const graded = ({ sessionId, completedAt, ...rest }: AssessmentResult) => {
      void sessionId;
      void completedAt;
      return JSON.stringify(rest);
    };
    expect(graded(gradedWithExtra({}))).toBe(graded(gradedWithExtra({ correct: true })));
  });

  it("grades a correct answer as a strength — the control for the two above", () => {
    mockAssessmentEngine.__reset();
    let session = mockAssessmentEngine.createSession(STUDENT_A, undefined, {
      bank: generatedBank,
      topics: ["closures"],
    });
    session = mockAssessmentEngine.submitAnswer(
      {
        sessionId: session.id,
        response: {
          type: "multiple_choice",
          questionId: session.currentQuestion!.id,
          optionId: "a", // the option the key marks correct
        },
        submissionId: "sub_right",
      },
      STUDENT_A,
    );
    for (let i = 0; i < 40 && session.status === "in_progress"; i += 1) {
      session = mockAssessmentEngine.submitAnswer(
        {
          sessionId: session.id,
          response: {
            type: "short_answer",
            questionId: session.currentQuestion!.id,
            answer: "the scope it was defined in stays enclosing the variable",
          },
          submissionId: `fin_${i}`,
        } as unknown as SubmitAnswerPayload,
        STUDENT_A,
      );
    }
    if (session.status === "in_progress") {
      mockAssessmentEngine.completeSession(session.id, STUDENT_A);
    }
    const result = mockAssessmentEngine.getResults(session.id, STUDENT_A);
    expect(result.strengths.map((s) => s.topic)).toContain("closures");
    expect(result.developingAreas.map((d) => d.topic)).not.toContain("closures");
  });
});

describe("isolation — goals, roadmaps and executions", () => {
  it("hides student A's goal from student B", () => {
    const { goal } = roadmapFor(STUDENT_A, "a");
    expect(mockGoalEngine.getGoal(goal.id, STUDENT_A).id).toBe(goal.id);
    // Preserved contract: goals answer 403. Unifying it with the 404s used
    // by roadmaps/assessments is a deliberate Phase 3 API decision.
    expect(() => mockGoalEngine.getGoal(goal.id, STUDENT_B)).toThrow(
      expect.objectContaining({ status: 403, code: "forbidden" }),
    );
  });

  it("hides student A's roadmap from student B", () => {
    const { roadmap } = roadmapFor(STUDENT_A, "a");
    expect(mockRoadmapEngine.getRoadmap(roadmap.id, STUDENT_A).id).toBe(roadmap.id);
    expect(() => mockRoadmapEngine.getRoadmap(roadmap.id, STUDENT_B)).toThrow(
      expect.objectContaining({ status: 404, code: "roadmap_not_found" }),
    );
    expect(mockRoadmapEngine.getActiveRoadmap(STUDENT_B)).toBeNull();
  });

  it("cannot drive student A's learning unit as student B", () => {
    const { roadmap } = roadmapFor(STUDENT_A, "a");
    const unitId = roadmap.milestones[0]!.learningUnits[0]!.id;

    // Nothing has been started yet, so A has no execution record either —
    // the derived view is what reports the unit as reachable.
    expect(mockExecutionEngine.getExecutionState(unitId, STUDENT_A)).toBeNull();
    expect(mockExecutionEngine.getExecutionView(STUDENT_A)?.unitStates[unitId]).toBe("available");
    // B has no active roadmap, so A's unit is unreachable for B — every
    // entry point refuses rather than resolving someone else's unit.
    expect(() => mockExecutionEngine.getExecutionState(unitId, STUDENT_B)).toThrow(
      expect.objectContaining({ name: "LearningUnitUnavailableError", reason: "no_active_roadmap" }),
    );
    expect(() => mockExecutionEngine.startLearningUnit(unitId, STUDENT_B)).toThrow(
      expect.objectContaining({ name: "LearningUnitUnavailableError", reason: "no_active_roadmap" }),
    );
    expect(() => mockExecutionEngine.getUnitContext(unitId, STUDENT_B)).toThrow(
      expect.objectContaining({ name: "LearningUnitUnavailableError", reason: "no_active_roadmap" }),
    );
    expect(mockExecutionEngine.getExecutionView(STUDENT_B)).toBeNull();
  });

  it("keeps a unit started by A invisible to B", () => {
    const { roadmap } = roadmapFor(STUDENT_A, "a");
    const unitId = roadmap.milestones[0]!.learningUnits[0]!.id;
    const started = mockExecutionEngine.startLearningUnit(unitId, STUDENT_A);
    expect(started.status).toBe("in_progress");
    expect(started.studentId).toBe(STUDENT_A);
    expect(() => mockExecutionEngine.getExecutionState(unitId, STUDENT_B)).toThrow();
    expect(mockExecutionEngine.getExecutionView(STUDENT_A)?.unitStates[unitId]).toBe("in_progress");
  });
});
