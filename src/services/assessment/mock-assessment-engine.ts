/**
 * Adaptive assessment engine — the assessment domain's orchestrator.
 *
 * This module holds the assessment "intelligence": question selection,
 * answer evaluation, difficulty adaptation, topic coverage, completion
 * detection and diagnostic synthesis. It is deterministic and framework
 * free.
 *
 * Boundaries respected:
 * - Storage is reached ONLY through the injected `AssessmentSessionStore`
 *   port — no `window`, no `localStorage`, no Prisma, no HTTP.
 * - Scoring data never leaves this module. `BankItem.scoring` stays on
 *   the stored session; `toClientSession` emits questions only.
 * - Every session is owned by a `studentId` resolved by the CALLER from
 *   the authenticated session. A session belonging to another student is
 *   indistinguishable from a missing one (404) — existence never leaks.
 * - Submissions are idempotent via the client's `submissionId`.
 */

import { ApiError } from "@/lib/api/client";
import {
  ASSESSMENT_TOPICS,
  QUESTION_BANK,
  findBankItem,
  type BankItem,
} from "@/services/assessment/question-bank";
import type {
  AssessmentSessionStore,
  StoredAssessmentSession,
  StoredTopicState,
} from "@/services/ports/stores";
import type {
  AdaptationNote,
  AssessmentDifficulty,
  AssessmentProgress,
  AssessmentQuestion,
  AssessmentResponse,
  AssessmentResult,
  AssessmentSession,
  AssessmentTopicId,
  DiagnosticConfidence,
  InsightCode,
  LearningInsight,
  RecommendedStartingPoint,
  StudentAssessmentProfile,
  SubmitAnswerPayload,
} from "@/types/assessment";

/* ------------------------------------------------------------------ */
/* Engine configuration (server-side; never rendered)                  */
/* ------------------------------------------------------------------ */

const MIN_QUESTIONS = 8;
const MAX_QUESTIONS = 13;
const EXPECTED_QUESTIONS = 10;
const AVG_SECONDS_PER_QUESTION = 75;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Engine wiring                                                       */
/* ------------------------------------------------------------------ */

export interface AssessmentEngineDeps {
  sessions: AssessmentSessionStore;
}

/** Engine-local alias — the persisted aggregate. */
type Session = StoredAssessmentSession;

function emptyTopicState(): StoredTopicState {
  return { asked: 0, points: 0, lastDifficulty: null, lastPoints: null };
}

function emptyTopics(customTopics?: AssessmentTopicId[]): Record<string, StoredTopicState> {
  const topics: Record<string, StoredTopicState> = {};
  for (const topic of customTopics ?? ASSESSMENT_TOPICS) topics[topic] = emptyTopicState();
  return topics;
}

function topicsOf(session: Session): AssessmentTopicId[] {
  return session.sessionTopics ?? ASSESSMENT_TOPICS;
}

function bankOf(session: Session): BankItem[] {
  return session.bank ?? QUESTION_BANK;
}

function findItem(session: Session, questionId: string): BankItem | undefined {
  if (session.bank) {
    const custom = session.bank.find((b) => b.question.id === questionId);
    if (custom) return custom;
  }
  return findBankItem(questionId);
}

/* ------------------------------------------------------------------ */
/* Scoring (engine-internal — never exposed)                           */
/* ------------------------------------------------------------------ */

function scoreResponse(item: BankItem, response: AssessmentResponse): number {
  if (item.scoring.kind === "option") {
    if (response.type === "multiple_choice" || response.type === "scenario") {
      if (response.optionId === item.scoring.correctOptionId) return 1;
      // Structured reasoning earns partial credit even on a wrong pick.
      if (response.type === "scenario" && (response.reasoning?.trim().length ?? 0) >= 24) {
        return 0.5;
      }
      return 0;
    }
    return 0;
  }
  if (response.type === "short_answer" || response.type === "problem_solving") {
    const text = response.answer.toLowerCase();
    const matches = item.scoring.keywords.filter((keyword) => text.includes(keyword)).length;
    if (matches >= item.scoring.minMatches) return 1;
    if (matches >= 1) return 0.5;
    // A substantive attempt that misses the keywords still shows engagement.
    if (response.answer.trim().length >= 80) return 0.5;
    return 0;
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/* Adaptive selection (engine-internal)                                */
/* ------------------------------------------------------------------ */

const DIFFICULTY_ORDER: AssessmentDifficulty[] = ["foundational", "intermediate", "advanced"];

function pickTopic(session: Session): AssessmentTopicId {
  // Coverage first: the least-explored topic wins; ties break toward the
  // topic whose last answer was correct (momentum) then declaration order.
  const ranked = [...topicsOf(session)].sort((a, b) => {
    const ta = session.topics[a] ?? emptyTopicState();
    const tb = session.topics[b] ?? emptyTopicState();
    if (ta.asked !== tb.asked) return ta.asked - tb.asked;
    const pa = ta.lastPoints ?? 0;
    const pb = tb.lastPoints ?? 0;
    if (pa !== pb) return pb - pa;
    return 0;
  });
  const [top] = ranked;
  if (!top) fail(500, "unknown", "assessment bank is empty");
  return top;
}

function pickDifficulty(session: Session, topic: AssessmentTopicId): AssessmentDifficulty {
  const state = session.topics[topic] ?? emptyTopicState();
  if (state.lastDifficulty === null || state.lastPoints === null) return "foundational";
  const index = DIFFICULTY_ORDER.indexOf(state.lastDifficulty);
  const clamped =
    state.lastPoints >= 0.5
      ? // Correct or partial → step up when possible.
        DIFFICULTY_ORDER[Math.min(index + 1, DIFFICULTY_ORDER.length - 1)]
      : // Incorrect → step down to consolidate foundations.
        DIFFICULTY_ORDER[Math.max(index - 1, 0)];
  return clamped ?? "foundational";
}

function pickQuestion(
  session: Session,
): { item: BankItem; note: AdaptationNote } | null {
  const askedIds = new Set(session.responses.map((r) => r.response.questionId));
  const topic = pickTopic(session);
  const difficulty = pickDifficulty(session, topic);
  const bank = bankOf(session);

  const topicCandidates = bank.filter(
    (item) => item.question.topic === topic && !askedIds.has(item.question.id),
  );
  const atDifficulty = topicCandidates.filter((item) => item.question.difficulty === difficulty);
  const item =
    atDifficulty[0] ??
    topicCandidates[0] ??
    bank.find((bankItem) => !askedIds.has(bankItem.question.id));
  if (!item) return null;

  const note: AdaptationNote =
    session.lastTopic !== null && session.lastTopic === topic
      ? difficulty === session.topics[topic]?.lastDifficulty
        ? "adjusting"
        : DIFFICULTY_ORDER.indexOf(difficulty) >
            DIFFICULTY_ORDER.indexOf(session.topics[topic]?.lastDifficulty ?? "foundational")
          ? "deepening"
          : "adjusting"
      : "moving_on";

  return { item, note };
}

/* ------------------------------------------------------------------ */
/* Completion + progress                                               */
/* ------------------------------------------------------------------ */

function shouldComplete(session: Session): boolean {
  const bank = bankOf(session);
  const maxQuestions = Math.min(MAX_QUESTIONS, bank.length);
  const minQuestions = Math.min(MIN_QUESTIONS, Math.max(3, Math.floor(bank.length * 0.7)));
  const answered = session.responses.length;
  if (answered >= maxQuestions) return true;
  if (answered < minQuestions) return false;
  return topicsOf(session).every((topic) => (session.topics[topic]?.asked ?? 0) >= 2);
}

function buildProgress(session: Session): AssessmentProgress {
  const list = topicsOf(session);
  const answered = session.responses.length;
  const topicsExplored = list.filter((t) => (session.topics[t]?.asked ?? 0) > 0).length;
  const expectedCount = Math.min(EXPECTED_QUESTIONS, bankOf(session).length);
  const remainingQuestions = Math.max(0, expectedCount - answered);
  const estimatedMinutesRemaining =
    session.status === "completed"
      ? 0
      : Math.max(1, Math.round((remainingQuestions * AVG_SECONDS_PER_QUESTION) / 60));
  const estimatedCompletionPercent =
    session.status === "completed"
      ? 100
      : Math.min(95, Math.max(5, Math.round((answered / expectedCount) * 100)));
  return {
    questionsAnswered: answered,
    topicsExplored,
    totalTopics: list.length,
    estimatedMinutesRemaining,
    estimatedCompletionPercent,
  };
}

/**
 * The client-safe projection. Deliberately excludes `bank`, `topics`,
 * `responses[].points` and every other piece of scoring data — the
 * answer key never crosses this boundary.
 */
function toClientSession(
  session: Session,
  currentQuestion: AssessmentQuestion | null,
  adaptationNote?: AdaptationNote,
): AssessmentSession {
  const bank = bankOf(session);
  const expectedCount = Math.min(EXPECTED_QUESTIONS, bank.length);
  return {
    id: session.id,
    status: session.status,
    startedAt: session.startedAt,
    estimatedDurationMinutes: Math.round((expectedCount * AVG_SECONDS_PER_QUESTION) / 60),
    currentQuestion,
    progress: buildProgress(session),
    profile: session.profile,
    ...(adaptationNote ? { adaptationNote } : {}),
  };
}

function currentQuestionFor(session: Session): AssessmentQuestion | null {
  if (session.status === "completed" || session.status === "expired") return null;
  const picked = pickQuestion(session);
  return picked ? cloneQuestion(picked.item.question) : null;
}

function cloneQuestion(question: AssessmentQuestion): AssessmentQuestion {
  return JSON.parse(JSON.stringify(question)) as AssessmentQuestion;
}

/* ------------------------------------------------------------------ */
/* Diagnostics synthesis (engine-internal)                             */
/* ------------------------------------------------------------------ */

function categorizeTopic(
  topic: AssessmentTopicId,
  session: Session,
): LearningInsight | null {
  const state = session.topics[topic];
  if (!state || state.asked === 0) return null;
  const rate = state.points / state.asked;
  const topicResponses = session.responses.filter(
    (r) => findItem(session, r.response.questionId)?.question.topic === topic,
  );

  let insight: InsightCode;
  if (state.asked >= 2 && rate >= 0.7) {
    const appliedCorrect = topicResponses.some(
      (r) =>
        r.points >= 1 &&
        (r.questionType === "scenario" ||
          r.questionType === "problem_solving" ||
          r.difficulty === "advanced"),
    );
    insight = appliedCorrect ? "strong_applied" : "strong_conceptual";
  } else if (rate < 0.4) {
    insight = "conceptual_gap";
  } else {
    insight = "fundamentals_need_practice";
  }
  return { topic, insight, basedOnResponses: state.asked };
}

function synthesizeResult(session: Session): AssessmentResult {
  const list = topicsOf(session);
  const insights = list
    .map((topic) => categorizeTopic(topic, session))
    .filter((insight): insight is LearningInsight => insight !== null);

  const strengths = insights.filter(
    (i) => i.insight === "strong_conceptual" || i.insight === "strong_applied",
  );
  const knowledgeGaps = insights.filter((i) => i.insight === "conceptual_gap");
  const developingAreas = insights.filter((i) => i.insight === "fundamentals_need_practice");

  const rateFor = (topic: AssessmentTopicId): number => {
    const state = session.topics[topic];
    return !state || state.asked === 0 ? 1 : state.points / state.asked;
  };

  const weakestOf = (items: LearningInsight[]): LearningInsight | undefined =>
    [...items].sort((a, b) => rateFor(a.topic) - rateFor(b.topic))[0];

  let recommendedStartingPoint: RecommendedStartingPoint | null = null;
  const weakestGap = weakestOf(knowledgeGaps);
  const weakestDeveloping = weakestOf(developingAreas);
  const [firstStrength] = strengths;
  if (weakestGap) {
    recommendedStartingPoint = { topic: weakestGap.topic, level: "foundational" };
  } else if (weakestDeveloping) {
    recommendedStartingPoint = { topic: weakestDeveloping.topic, level: "intermediate" };
  } else if (firstStrength) {
    recommendedStartingPoint = { topic: firstStrength.topic, level: "intermediate" };
  }

  const answered = session.responses.length;
  const topicsExplored = list.filter((t) => (session.topics[t]?.asked ?? 0) > 0).length;
  let confidence: DiagnosticConfidence = "low";
  if (answered >= 6 && topicsExplored === list.length) confidence = "high";
  else if (answered >= 4) confidence = "medium";

  return {
    sessionId: session.id,
    completedAt: session.completedAt ?? new Date().toISOString(),
    questionsAnswered: answered,
    strengths,
    developingAreas,
    knowledgeGaps,
    recommendedStartingPoint,
    confidence,
  };
}

/* ------------------------------------------------------------------ */
/* The engine                                                          */
/* ------------------------------------------------------------------ */

function fail(status: number, code: string, message = code): never {
  throw new ApiError(message, status, code);
}

function expireIfNeeded(session: Session): void {
  if (session.status === "completed" || session.status === "expired") return;
  if (Date.now() - new Date(session.startedAt).getTime() > SESSION_TTL_MS) {
    session.status = "expired";
  }
}

function newSessionId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `asess_${random}`;
}

/**
 * Ownership gate. A foreign session is reported exactly like a missing
 * one so existence is never leaked across students.
 */
function ownSession(
  store: AssessmentSessionStore,
  sessionId: string,
  studentId: string,
): Session {
  const session = store.findById(sessionId);
  if (!session || session.studentId !== studentId) fail(404, "session_not_found");
  expireIfNeeded(session);
  return session;
}

export function createAssessmentEngine(deps: AssessmentEngineDeps) {
  const { sessions: store } = deps;

  return {
    createSession(
      studentId: string,
      profile?: StudentAssessmentProfile,
      customData?: { bank: BankItem[]; topics: string[] },
    ): AssessmentSession {
      // A brand-new session supersedes any unfinished one OF THIS STUDENT
      // (the UI warns first). Other students are never touched.
      for (const existing of store.listByStudent(studentId)) {
        if (existing.status === "in_progress" || existing.status === "paused") {
          existing.status = "expired";
          store.upsert(existing);
        }
      }
      const topicsList = customData?.topics ?? ASSESSMENT_TOPICS;
      const session: Session = {
        id: newSessionId(),
        studentId,
        status: "in_progress",
        startedAt: new Date().toISOString(),
        responses: [],
        topics: emptyTopics(topicsList),
        lastTopic: null,
        ...(profile ? { profile } : {}),
        ...(customData?.bank ? { bank: customData.bank } : {}),
        sessionTopics: topicsList,
      };
      store.upsert(session);
      const picked = pickQuestion(session);
      return toClientSession(session, picked ? cloneQuestion(picked.item.question) : null);
    },

    getActiveSession(studentId: string): AssessmentSession | null {
      let active: Session | undefined;
      for (const session of store.listByStudent(studentId)) {
        expireIfNeeded(session);
        if (session.status !== "in_progress" && session.status !== "paused") continue;
        if (!active || session.startedAt > active.startedAt) active = session;
      }
      return active ? toClientSession(active, currentQuestionFor(active)) : null;
    },

    getSession(sessionId: string, studentId: string): AssessmentSession {
      const session = ownSession(store, sessionId, studentId);
      return toClientSession(session, currentQuestionFor(session));
    },

    submitAnswer(payload: SubmitAnswerPayload, studentId: string): AssessmentSession {
      const { sessionId, response, submissionId } = payload;
      const session = ownSession(store, sessionId, studentId);
      if (session.status !== "in_progress") fail(409, "session_not_active");

      // Idempotency: an already-accepted submissionId returns current state
      // without re-evaluating — safe retries after network failures.
      if (session.responses.some((r) => r.submissionId === submissionId)) {
        return toClientSession(session, currentQuestionFor(session));
      }

      const item = findItem(session, response.questionId);
      if (!item) fail(422, "invalid_response");
      const expected = currentQuestionFor(session);
      if (!expected || expected.id !== response.questionId) fail(422, "invalid_response");
      if (item.question.type !== response.type) fail(422, "invalid_response");

      const points = scoreResponse(item, response);
      session.responses.push({
        submissionId,
        response,
        points,
        difficulty: item.question.difficulty,
        questionType: item.question.type,
        at: new Date().toISOString(),
      });

      const topicState = session.topics[item.question.topic] ?? emptyTopicState();
      topicState.asked += 1;
      topicState.points += points;
      topicState.lastDifficulty = item.question.difficulty;
      topicState.lastPoints = points;
      session.topics[item.question.topic] = topicState;
      session.lastTopic = item.question.topic;

      if (shouldComplete(session)) {
        session.status = "completed";
        session.completedAt = new Date().toISOString();
        store.upsert(session);
        return toClientSession(session, null);
      }

      const picked = pickQuestion(session);
      store.upsert(session);
      return toClientSession(
        session,
        picked ? cloneQuestion(picked.item.question) : null,
        picked?.note,
      );
    },

    pauseSession(sessionId: string, studentId: string): AssessmentSession {
      const session = ownSession(store, sessionId, studentId);
      if (session.status !== "in_progress") fail(409, "session_not_active");
      session.status = "paused";
      store.upsert(session);
      return toClientSession(session, null);
    },

    resumeSession(sessionId: string, studentId: string): AssessmentSession {
      const session = ownSession(store, sessionId, studentId);
      if (session.status === "completed" || session.status === "expired") {
        fail(409, "session_not_active");
      }
      session.status = "in_progress";
      store.upsert(session);
      return toClientSession(session, currentQuestionFor(session));
    },

    completeSession(sessionId: string, studentId: string): AssessmentSession {
      const session = ownSession(store, sessionId, studentId);
      if (session.status !== "in_progress" && session.status !== "paused") {
        fail(409, "session_not_active");
      }
      session.status = "completed";
      session.completedAt = new Date().toISOString();
      store.upsert(session);
      return toClientSession(session, null);
    },

    getResults(sessionId: string, studentId: string): AssessmentResult {
      const session = ownSession(store, sessionId, studentId);
      if (session.status !== "completed") fail(409, "assessment_not_completed");
      return synthesizeResult(session);
    },

    /**
     * Most recent completed assessment result for THIS student, or null.
     * Consumed by the goal engine so diagnosis context is resolved from
     * the owner's own history — never carried by the client.
     */
    getLatestCompletedResult(studentId: string): AssessmentResult | null {
      const completed = store
        .listByStudent(studentId)
        .filter((s) => s.status === "completed")
        .sort((a, b) =>
          (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt),
        )[0];
      return completed ? synthesizeResult(completed) : null;
    },

    /** Test seam: clears this engine's persisted sessions. */
    __reset(): void {
      store.clear();
    },
  };
}

export type AssessmentEngine = ReturnType<typeof createAssessmentEngine>;
