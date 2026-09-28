/**
 * Mock assessment engine — the simulated backend's adaptive contract.
 * These tests play the role of the AI engine's acceptance suite: selection,
 * adaptation, idempotency, lifecycle and diagnostics.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { mockAssessmentEngine } from "@/services/engines";
import { findBankItem } from "@/services/assessment/question-bank";
import type {
  AssessmentQuestion,
  AssessmentResponse,
  AssessmentSession,
} from "@/types/assessment";

/**
 * Owner for direct engine calls. Component tests must use the id the
 * mock auth backend signs in (`usr_student_01`) so the service's
 * session-resolved student matches the engine's stored owner.
 */
const STUDENT = "student_a";

/** Builds a response the engine will score as correct (tests may see the bank). */
function correctResponseFor(question: AssessmentQuestion, submissionNote = ""): AssessmentResponse {
  const item = findBankItem(question.id);
  if (!item) throw new Error(`bank item missing for ${question.id}`);
  switch (question.type) {
    case "multiple_choice":
      return {
        type: "multiple_choice",
        questionId: question.id,
        optionId:
          item.scoring.kind === "option" ? item.scoring.correctOptionId : question.options?.[0]?.id ?? "",
      };
    case "scenario":
      return {
        type: "scenario",
        questionId: question.id,
        optionId:
          item.scoring.kind === "option" ? item.scoring.correctOptionId : question.options?.[0]?.id ?? "",
        reasoning: submissionNote,
      };
    case "short_answer":
    case "problem_solving":
      return {
        type: question.type,
        questionId: question.id,
        answer:
          item.scoring.kind === "keywords"
            ? item.scoring.keywords.slice(0, item.scoring.minMatches + 1).join(" and ")
            : "a considered answer",
      };
  }
}

function wrongResponseFor(question: AssessmentQuestion): AssessmentResponse {
  switch (question.type) {
    case "multiple_choice": {
      const wrong = question.options?.find((o) => {
        const item = findBankItem(question.id);
        return item?.scoring.kind === "option" && item.scoring.correctOptionId !== o.id;
      });
      return {
        type: "multiple_choice",
        questionId: question.id,
        optionId: wrong?.id ?? "definitely-wrong",
      };
    }
    case "scenario":
      return { type: "scenario", questionId: question.id, optionId: "definitely-wrong" };
    case "short_answer":
    case "problem_solving":
      return { type: question.type, questionId: question.id, answer: "xyz" };
  }
}

function answer(
  session: AssessmentSession,
  build: (q: AssessmentQuestion) => AssessmentResponse,
): AssessmentSession {
  const question = session.currentQuestion;
  if (!question) throw new Error("no current question");
  return mockAssessmentEngine.submitAnswer({
    sessionId: session.id,
    response: build(question),
    submissionId: `sub_${question.id}_${Math.random().toString(36).slice(2, 8)}`,
  }, STUDENT);
}

function answerCorrectly(session: AssessmentSession): AssessmentSession {
  return answer(session, (q) => correctResponseFor(q));
}

function apiErrorOf(fn: () => unknown): ApiError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error("expected an ApiError to be thrown");
}

describe("mock assessment engine", () => {
  beforeEach(() => {
    mockAssessmentEngine.__reset();
  });

  describe("session lifecycle", () => {
    it("creates an in-progress session with a first question", () => {
      const session = mockAssessmentEngine.createSession(STUDENT);
      expect(session.id).toMatch(/^asess_/);
      expect(session.status).toBe("in_progress");
      expect(session.currentQuestion).not.toBeNull();
      expect(session.progress.questionsAnswered).toBe(0);
      expect(session.estimatedDurationMinutes).toBeGreaterThan(0);
    });

    it("starts every session at foundational difficulty", () => {
      const session = mockAssessmentEngine.createSession(STUDENT);
      expect(session.currentQuestion?.difficulty).toBe("foundational");
    });

    it("returns the session by id and 404s for unknown ids", () => {
      const session = mockAssessmentEngine.createSession(STUDENT);
      expect(mockAssessmentEngine.getSession(session.id, STUDENT).id).toBe(session.id);
      const error = apiErrorOf(() => mockAssessmentEngine.getSession("asess_nope", STUDENT));
      expect(error.status).toBe(404);
      expect(error.code).toBe("session_not_found");
    });

    it("tracks the active session and clears it on completion", () => {
      const session = mockAssessmentEngine.createSession(STUDENT);
      expect(mockAssessmentEngine.getActiveSession(STUDENT)?.id).toBe(session.id);
      mockAssessmentEngine.completeSession(session.id, STUDENT);
      expect(mockAssessmentEngine.getActiveSession(STUDENT)).toBeNull();
    });

    it("supersedes an unfinished session when a new one is created", () => {
      const first = mockAssessmentEngine.createSession(STUDENT);
      const second = mockAssessmentEngine.createSession(STUDENT);
      expect(second.id).not.toBe(first.id);
      expect(mockAssessmentEngine.getSession(first.id, STUDENT).status).toBe("expired");
      expect(mockAssessmentEngine.getActiveSession(STUDENT)?.id).toBe(second.id);
    });

    it("pauses and resumes without losing progress", () => {
      let session = mockAssessmentEngine.createSession(STUDENT);
      session = answerCorrectly(session);

      const paused = mockAssessmentEngine.pauseSession(session.id, STUDENT);
      expect(paused.status).toBe("paused");
      expect(paused.currentQuestion).toBeNull();
      expect(paused.progress.questionsAnswered).toBe(1);

      const resumed = mockAssessmentEngine.resumeSession(session.id, STUDENT);
      expect(resumed.status).toBe("in_progress");
      expect(resumed.currentQuestion).not.toBeNull();
      expect(resumed.progress.questionsAnswered).toBe(1);
    });

    it("rejects answers submitted to a paused session", () => {
      const session = mockAssessmentEngine.createSession(STUDENT);
      mockAssessmentEngine.pauseSession(session.id, STUDENT);
      const question = mockAssessmentEngine.resumeSession(session.id, STUDENT).currentQuestion;
      mockAssessmentEngine.pauseSession(session.id, STUDENT);
      const error = apiErrorOf(() =>
        mockAssessmentEngine.submitAnswer({
          sessionId: session.id,
          response: correctResponseFor(question!),
          submissionId: "sub_paused",
        }, STUDENT),
      );
      expect(error.status).toBe(409);
      expect(error.code).toBe("session_not_active");
    });

    it("completes explicitly and rejects further answers", () => {
      const session = mockAssessmentEngine.createSession(STUDENT);
      const completed = mockAssessmentEngine.completeSession(session.id, STUDENT);
      expect(completed.status).toBe("completed");
      expect(completed.currentQuestion).toBeNull();
      const error = apiErrorOf(() =>
        mockAssessmentEngine.submitAnswer({
          sessionId: session.id,
          response: { type: "short_answer", questionId: "fn_a1", answer: "late" },
          submissionId: "sub_late",
        }, STUDENT),
      );
      expect(error.code).toBe("session_not_active");
    });
  });

  describe("adaptive behavior", () => {
    it("returns a next question after each answer and counts progress", () => {
      let session = mockAssessmentEngine.createSession(STUDENT);
      const firstId = session.currentQuestion?.id;
      session = answerCorrectly(session);
      expect(session.progress.questionsAnswered).toBe(1);
      expect(session.currentQuestion).not.toBeNull();
      expect(session.currentQuestion?.id).not.toBe(firstId);
    });

    it("rotates across topics before deepening (coverage first)", () => {
      let session = mockAssessmentEngine.createSession(STUDENT);
      const topics = new Set<string>();
      for (let i = 0; i < 5 && session.currentQuestion; i += 1) {
        topics.add(session.currentQuestion.topic);
        session = answerCorrectly(session);
      }
      expect(topics.size).toBe(5);
    });

    it("steps difficulty up after correct answers", () => {
      let session = mockAssessmentEngine.createSession(STUDENT);
      // Five correct answers cover every topic once; the sixth must deepen.
      for (let i = 0; i < 5; i += 1) session = answerCorrectly(session);
      expect(session.currentQuestion?.difficulty).toBe("intermediate");
    });

    it("never asks the same question twice", () => {
      let session = mockAssessmentEngine.createSession(STUDENT);
      const asked = new Set<string>();
      while (session.currentQuestion && session.status === "in_progress") {
        expect(asked.has(session.currentQuestion.id)).toBe(false);
        asked.add(session.currentQuestion.id);
        session = answerCorrectly(session);
      }
      expect(asked.size).toBeGreaterThanOrEqual(8);
    });

    it("emits adaptation notes the UI can render (without engine internals)", () => {
      let session = mockAssessmentEngine.createSession(STUDENT);
      session = answerCorrectly(session);
      // Topic rotation on the second question → "moving_on".
      expect(session.adaptationNote).toBe("moving_on");
    });

    it("completes on its own once coverage and minimum length are met", () => {
      let session = mockAssessmentEngine.createSession(STUDENT);
      let guard = 0;
      while (session.status === "in_progress" && guard < 20) {
        session = answerCorrectly(session);
        guard += 1;
      }
      expect(session.status).toBe("completed");
      expect(session.currentQuestion).toBeNull();
      expect(session.progress.questionsAnswered).toBeGreaterThanOrEqual(8);
      expect(session.progress.questionsAnswered).toBeLessThanOrEqual(13);
      expect(session.progress.estimatedCompletionPercent).toBe(100);
    });
  });

  describe("submission safety", () => {
    it("is idempotent: a replayed submissionId never double-counts", () => {
      const session = mockAssessmentEngine.createSession(STUDENT);
      const question = session.currentQuestion!;
      const payload = {
        sessionId: session.id,
        response: correctResponseFor(question),
        submissionId: "sub_retry_1",
      };
      const first = mockAssessmentEngine.submitAnswer(payload, STUDENT);
      const replay = mockAssessmentEngine.submitAnswer(payload, STUDENT);
      expect(first.progress.questionsAnswered).toBe(1);
      expect(replay.progress.questionsAnswered).toBe(1);
      expect(replay.currentQuestion?.id).toBe(first.currentQuestion?.id);
    });

    it("rejects a response for a question that is not current", () => {
      const session = mockAssessmentEngine.createSession(STUDENT);
      const error = apiErrorOf(() =>
        mockAssessmentEngine.submitAnswer({
          sessionId: session.id,
          response: { type: "short_answer", questionId: "sc_a1", answer: "out of order" },
          submissionId: "sub_wrong_question",
        }, STUDENT),
      );
      expect(error.status).toBe(422);
      expect(error.code).toBe("invalid_response");
    });

    it("rejects a response whose type does not match the question", () => {
      const session = mockAssessmentEngine.createSession(STUDENT);
      const question = session.currentQuestion!;
      const error = apiErrorOf(() =>
        mockAssessmentEngine.submitAnswer({
          sessionId: session.id,
          response: { type: "short_answer", questionId: question.id, answer: "wrong shape" },
          submissionId: "sub_wrong_type",
        }, STUDENT),
      );
      expect(error.code).toBe("invalid_response");
    });
  });

  describe("diagnostic results", () => {
    it("refuses results before completion", () => {
      const session = mockAssessmentEngine.createSession(STUDENT);
      const error = apiErrorOf(() => mockAssessmentEngine.getResults(session.id, STUDENT));
      expect(error.status).toBe(409);
      expect(error.code).toBe("assessment_not_completed");
    });

    it("reports strengths and a recommended starting point after strong answers", () => {
      let session = mockAssessmentEngine.createSession(STUDENT);
      while (session.status === "in_progress") session = answerCorrectly(session);
      const result = mockAssessmentEngine.getResults(session.id, STUDENT);

      expect(result.questionsAnswered).toBeGreaterThanOrEqual(8);
      expect(result.strengths.length).toBeGreaterThan(0);
      expect(result.knowledgeGaps).toHaveLength(0);
      expect(result.recommendedStartingPoint).not.toBeNull();
      expect(result.confidence).toBe("high");
      // No bare numeric score — qualitative model only.
      expect(result).not.toHaveProperty("overallReadiness");
    });

    it("reports knowledge gaps and a foundational start after wrong answers", () => {
      let session = mockAssessmentEngine.createSession(STUDENT);
      while (session.status === "in_progress") session = answer(session, wrongResponseFor);
      const result = mockAssessmentEngine.getResults(session.id, STUDENT);

      expect(result.knowledgeGaps.length).toBeGreaterThan(0);
      expect(result.strengths).toHaveLength(0);
      expect(result.recommendedStartingPoint?.level).toBe("foundational");
    });

    it("keeps confidence low for an abandoned-early session", () => {
      const session = mockAssessmentEngine.createSession(STUDENT);
      mockAssessmentEngine.completeSession(session.id, STUDENT);
      const result = mockAssessmentEngine.getResults(session.id, STUDENT);
      expect(result.questionsAnswered).toBe(0);
      expect(result.confidence).toBe("low");
      expect(result.recommendedStartingPoint).toBeNull();
    });

    it("never leaks scoring data through questions or results", () => {
      let session = mockAssessmentEngine.createSession(STUDENT);
      const serialized = JSON.stringify(session.currentQuestion);
      expect(serialized).not.toContain("correctOptionId");
      expect(serialized).not.toContain("keywords");
      while (session.status === "in_progress") session = answerCorrectly(session);
      const resultJson = JSON.stringify(mockAssessmentEngine.getResults(session.id, STUDENT));
      expect(resultJson).not.toContain("correctOptionId");
      expect(resultJson).not.toContain("points");
    });
  });
});
