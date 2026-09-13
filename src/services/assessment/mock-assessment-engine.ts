/**
 * Mock adaptive assessment engine — the simulated backend.
 *
 * This module is the ONLY place assessment "intelligence" exists in the
 * mock phase: question selection, answer evaluation, difficulty
 * adaptation, topic coverage, completion detection and diagnostic
 * synthesis. When the real AI service arrives, it replaces this module
 * behind the identical `assessment.service.ts` contract; no UI changes.
 *
 * Boundaries respected:
 * - Scoring data never leaves this module (bank items stay server-side).
 * - Submissions are idempotent via client `submissionId` (§16).
 * - Sessions persist to localStorage like the mock auth backend does.
 */

import { ApiError } from "@/lib/api/client";
import {
  ASSESSMENT_TOPICS,
  QUESTION_BANK,
  findBankItem,
  type BankItem,
} from "@/services/assessment/question-bank";
import type {
  AdaptationNote,
  AssessmentDifficulty,
  AssessmentProgress,
  AssessmentQuestion,
  AssessmentResponse,
  AssessmentResult,
  AssessmentSession,
  AssessmentStatus,
  AssessmentTopicId,
  DiagnosticConfidence,
  InsightCode,
  LearningInsight,
  RecommendedStartingPoint,
  StudentAssessmentProfile,
  SubmitAnswerPayload,
} from "@/types/assessment";

/* ------------------------------------------------------------------ */
/* Engine configuration (backend-side; never rendered)                  */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "mureeh.mock.assessment.v1";
const MIN_QUESTIONS = 8;
const MAX_QUESTIONS = 13;
const EXPECTED_QUESTIONS = 10;
const AVG_SECONDS_PER_QUESTION = 75;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Internal state                                                      */
/* ------------------------------------------------------------------ */

interface ScoredResponse {
  submissionId: string;
  response: AssessmentResponse;
  /** 1 = correct, 0.5 = partial (reasoning credit / keyword near-miss), 0 = incorrect. */
  points: number;
  difficulty: AssessmentDifficulty;
  questionType: AssessmentQuestion["type"];
  at: string;
}

interface TopicState {
  asked: number;
  points: number;
  lastDifficulty: AssessmentDifficulty | null;
  lastPoints: number | null;
}

interface EngineSession {
  id: string;
  status: Exclude<AssessmentStatus, "not_started">;
  startedAt: string;
  completedAt?: string;
  responses: ScoredResponse[];
  topics: Record<AssessmentTopicId, TopicState>;
  lastTopic: AssessmentTopicId | null;
  profile?: StudentAssessmentProfile;
  customBank?: BankItem[];
  customTopics?: AssessmentTopicId[];
}

function emptyTopicState(): TopicState {
  return { asked: 0, points: 0, lastDifficulty: null, lastPoints: null };
}

function emptyTopics(customTopics?: AssessmentTopicId[]): Record<AssessmentTopicId, TopicState> {
  const topics = {} as Record<AssessmentTopicId, TopicState>;
  const list = customTopics ?? ASSESSMENT_TOPICS;
  for (const topic of list) topics[topic] = emptyTopicState();
  return topics;
}

function findItem(session: EngineSession, questionId: string): BankItem | undefined {
  if (session.customBank) {
    const custom = session.customBank.find((b) => b.question.id === questionId);
    if (custom) return custom;
  }
  return findBankItem(questionId);
}

/* ------------------------------------------------------------------ */
/* Persistence (guarded; falls back to memory-only)                    */
/* ------------------------------------------------------------------ */

let memoryStore: EngineSession[] = [];

function loadSessions(): EngineSession[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryStore;
    const parsed = JSON.parse(raw) as EngineSession[];
    if (!Array.isArray(parsed)) return memoryStore;
    memoryStore = parsed;
    return memoryStore;
  } catch {
    return memoryStore;
  }
}

function saveSessions(sessions: EngineSession[]): void {
  memoryStore = sessions;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // Storage unavailable (private mode): memory-only is acceptable for the mock.
  }
}

/* ------------------------------------------------------------------ */
/* Scoring (engine-internal)                                           */
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

function pickTopic(session: EngineSession): AssessmentTopicId {
  // Coverage first: the least-explored topic wins; ties break toward the
  // topic whose last answer was correct (momentum) then declaration order.
  const topicsList = session.customTopics ?? ASSESSMENT_TOPICS;
  const ranked = [...topicsList].sort((a, b) => {
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

function pickDifficulty(session: EngineSession, topic: AssessmentTopicId): AssessmentDifficulty {
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
  session: EngineSession,
): { item: BankItem; note: AdaptationNote } | null {
  const askedIds = new Set(session.responses.map((r) => r.response.questionId));
  const topic = pickTopic(session);
  const difficulty = pickDifficulty(session, topic);
  const bank = session.customBank ?? QUESTION_BANK;

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

function shouldComplete(session: EngineSession): boolean {
  const bank = session.customBank ?? QUESTION_BANK;
  const maxQuestions = Math.min(MAX_QUESTIONS, bank.length);
  const minQuestions = Math.min(MIN_QUESTIONS, Math.max(3, Math.floor(bank.length * 0.7)));
  const answered = session.responses.length;
  if (answered >= maxQuestions) return true;
  if (answered < minQuestions) return false;
  const topicsList = session.customTopics ?? ASSESSMENT_TOPICS;
  return topicsList.every((topic) => (session.topics[topic]?.asked ?? 0) >= 2);
}

function buildProgress(session: EngineSession): AssessmentProgress {
  const topicsList = session.customTopics ?? ASSESSMENT_TOPICS;
  const answered = session.responses.length;
  const topicsExplored = topicsList.filter((t) => (session.topics[t]?.asked ?? 0) > 0).length;
  const expectedCount = Math.min(EXPECTED_QUESTIONS, (session.customBank ?? QUESTION_BANK).length);
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
    totalTopics: topicsList.length,
    estimatedMinutesRemaining,
    estimatedCompletionPercent,
  };
}

function toClientSession(
  session: EngineSession,
  currentQuestion: AssessmentQuestion | null,
  adaptationNote?: AdaptationNote,
): AssessmentSession {
  const bank = session.customBank ?? QUESTION_BANK;
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

function currentQuestionFor(session: EngineSession): AssessmentQuestion | null {
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
  session: EngineSession,
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
      (r) => r.points >= 1 && (r.questionType === "scenario" || r.questionType === "problem_solving" || r.difficulty === "advanced"),
    );
    insight = appliedCorrect ? "strong_applied" : "strong_conceptual";
  } else if (rate < 0.4) {
    insight = "conceptual_gap";
  } else {
    insight = "fundamentals_need_practice";
  }
  return { topic, insight, basedOnResponses: state.asked };
}

function synthesizeResult(session: EngineSession): AssessmentResult {
  const topicsList = session.customTopics ?? ASSESSMENT_TOPICS;
  const insights = topicsList.map((topic) => categorizeTopic(topic, session)).filter(
    (insight): insight is LearningInsight => insight !== null,
  );

  const strengths = insights.filter((i) => i.insight === "strong_conceptual" || i.insight === "strong_applied");
  const knowledgeGaps = insights.filter((i) => i.insight === "conceptual_gap");
  const developingAreas = insights.filter((i) => i.insight === "fundamentals_need_practice");

  const rateFor = (topic: AssessmentTopicId): number => {
    const state = session.topics[topic];
    return !state || state.asked === 0 ? 1 : state.points / state.asked;
  };

  const weakestOf = (insights: LearningInsight[]): LearningInsight | undefined =>
    [...insights].sort((a, b) => rateFor(a.topic) - rateFor(b.topic))[0];

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
  const topicsExplored = topicsList.filter((t) => (session.topics[t]?.asked ?? 0) > 0).length;
  let confidence: DiagnosticConfidence = "low";
  if (answered >= 6 && topicsExplored === topicsList.length) confidence = "high";
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
/* Public engine API (consumed only by assessment.service.ts)          */
/* ------------------------------------------------------------------ */

function fail(status: number, code: string, message = code): never {
  throw new ApiError(message, status, code);
}

function mutateSession(
  id: string,
  mutate: (session: EngineSession, sessions: EngineSession[]) => void,
): EngineSession {
  const sessions = loadSessions();
  const session = sessions.find((s) => s.id === id);
  if (!session) fail(404, "session_not_found");
  expireIfNeeded(session);
  mutate(session, sessions);
  saveSessions(sessions);
  return session;
}

function expireIfNeeded(session: EngineSession): void {
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

export const mockAssessmentEngine = {
  createSession(
    profile?: StudentAssessmentProfile,
    customData?: { bank: BankItem[]; topics: string[] },
  ): AssessmentSession {
    const sessions = loadSessions();
    // A brand-new session supersedes any unfinished one (the UI warns first).
    for (const existing of sessions) {
      if (existing.status === "in_progress" || existing.status === "paused") {
        existing.status = "expired";
      }
    }
    const topicsList = customData?.topics ?? ASSESSMENT_TOPICS;
    const session: EngineSession = {
      id: newSessionId(),
      status: "in_progress",
      startedAt: new Date().toISOString(),
      responses: [],
      topics: emptyTopics(topicsList),
      lastTopic: null,
      profile,
      customBank: customData?.bank,
      customTopics: topicsList,
    };
    sessions.push(session);
    saveSessions(sessions);
    const picked = pickQuestion(session);
    return toClientSession(session, picked ? cloneQuestion(picked.item.question) : null);
  },

  getActiveSession(): AssessmentSession | null {
    const sessions = loadSessions();
    const active = sessions
      .filter((s) => s.status === "in_progress" || s.status === "paused")
      .filter((s) => {
        expireIfNeeded(s);
        return s.status === "in_progress" || s.status === "paused";
      })
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    if (!active) return null;
    saveSessions(sessions);
    return toClientSession(active, currentQuestionFor(active));
  },

  getSession(sessionId: string): AssessmentSession {
    const sessions = loadSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) fail(404, "session_not_found");
    expireIfNeeded(session);
    saveSessions(sessions);
    return toClientSession(session, currentQuestionFor(session));
  },

  submitAnswer(payload: SubmitAnswerPayload): AssessmentSession {
    const { sessionId, response, submissionId } = payload;
    const sessions = loadSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) fail(404, "session_not_found");
    expireIfNeeded(session);
    if (session.status !== "in_progress") fail(409, "session_not_active");

    // Idempotency: an already-accepted submissionId returns current state
    // without re-evaluating — safe retries after network failures.
    if (session.responses.some((r) => r.submissionId === submissionId)) {
      saveSessions(sessions);
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

    let topicState = session.topics[item.question.topic];
    if (!topicState) {
      topicState = emptyTopicState();
      session.topics[item.question.topic] = topicState;
    }
    topicState.asked += 1;
    topicState.points += points;
    topicState.lastDifficulty = item.question.difficulty;
    topicState.lastPoints = points;
    session.lastTopic = item.question.topic;

    if (shouldComplete(session)) {
      session.status = "completed";
      session.completedAt = new Date().toISOString();
      saveSessions(sessions);
      return toClientSession(session, null);
    }

    const picked = pickQuestion(session);
    saveSessions(sessions);
    return toClientSession(
      session,
      picked ? cloneQuestion(picked.item.question) : null,
      picked?.note,
    );
  },

  pauseSession(sessionId: string): AssessmentSession {
    const session = mutateSession(sessionId, (s) => {
      if (s.status !== "in_progress") fail(409, "session_not_active");
      s.status = "paused";
    });
    return toClientSession(session, null);
  },

  resumeSession(sessionId: string): AssessmentSession {
    const session = mutateSession(sessionId, (s) => {
      if (s.status === "completed" || s.status === "expired") fail(409, "session_not_active");
      s.status = "in_progress";
    });
    return toClientSession(session, currentQuestionFor(session));
  },

  completeSession(sessionId: string): AssessmentSession {
    const session = mutateSession(sessionId, (s) => {
      if (s.status !== "in_progress" && s.status !== "paused") fail(409, "session_not_active");
      s.status = "completed";
      s.completedAt = new Date().toISOString();
    });
    return toClientSession(session, null);
  },

  getResults(sessionId: string): AssessmentResult {
    const sessions = loadSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) fail(404, "session_not_found");
    expireIfNeeded(session);
    if (session.status !== "completed") fail(409, "assessment_not_completed");
    return synthesizeResult(session);
  },

  /**
   * Most recent completed assessment result, or null. Consumed by the
   * STEP 5 goal engine so diagnosis context is resolved server-side —
   * the client never has to carry it between features.
   */
  getLatestCompletedResult(): AssessmentResult | null {
    const sessions = loadSessions();
    const completed = sessions
      .filter((s) => s.status === "completed")
      .sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt))[0];
    if (!completed) return null;
    return synthesizeResult(completed);
  },

  /** Test helper: clears persisted mock state between tests. */
  __reset(): void {
    memoryStore = [];
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore unavailable storage in non-browser contexts.
    }
  },
};
