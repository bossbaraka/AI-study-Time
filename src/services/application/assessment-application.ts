/**
 * Assessment application service — server-side coordination for assessment routes.
 *
 * Session creation is the one cross-boundary operation: the AI question
 * generator returns an internal bank with answer keys, and the domain engine
 * persists it while returning only the public projection. The other methods
 * are intentionally small use-case entry points so HTTP handlers depend on
 * this application boundary, not on the server composition root.
 *
 * Route → this service → assessment engine
 *             → AssessmentSessionStore → Prisma → PostgreSQL.
 *
 * Rate limiting stays in the route wrapper: it is HTTP/request policy and
 * must happen before the paid model call. Student identity is always the
 * authenticated session identity supplied by `withStudent`.
 */

import { generateAssessmentQuestions } from "@/lib/server/ai/question-generator";
import { assessmentEngine } from "@/services/engines.server";
import type {
  AssessmentResult,
  AssessmentSession,
  StudentAssessmentProfile,
  SubmitAnswerPayload,
} from "@/types/assessment";

export const assessmentApplication = {
  async createSession(
    studentId: string,
    profile?: StudentAssessmentProfile,
  ): Promise<AssessmentSession> {
    const customData = profile ? await generateAssessmentQuestions(profile) : undefined;
    return assessmentEngine.createSession(studentId, profile, customData);
  },

  getActiveSession(studentId: string): Promise<AssessmentSession | null> {
    return assessmentEngine.getActiveSession(studentId);
  },

  getSession(sessionId: string, studentId: string): Promise<AssessmentSession> {
    return assessmentEngine.getSession(sessionId, studentId);
  },

  async submitAnswer(payload: SubmitAnswerPayload, studentId: string): Promise<AssessmentSession> {
    const session = await assessmentEngine.submitAnswer(payload, studentId);
    // Intelligence: record per-answer evidence asynchronously (best-effort)
    try {
      const { recordAssessmentEvidence } = await import("@/services/application/intelligence-application");
      // Derive topic/question from the submission; the engine scored it, but we can extract the topic
      // by re-reading the session's stored answer for this submissionId — simpler: parse from returned session progress
      // For now, record with topic derived from the payload's questionId prefix or previous engine state.
      // The assessment store holds the canonical question topic; fetch it via a lightweight helper.
      let topic: string | null = null;
      let points = 0;
      try {
        const { getPool } = await import("@/services/infrastructure/pg-pool");
        const pool = getPool();
        const { rows } = await pool.query(`SELECT "topic","difficulty" FROM "AssessmentQuestion" WHERE "sessionId"=$1 AND "questionId"=$2 LIMIT 1`, [payload.sessionId, payload.response.questionId]);
        if (rows[0]) topic = rows[0].topic as string;
        const ar = await pool.query(`SELECT "points" FROM "AssessmentAnswer" WHERE "sessionId"=$1 AND "submissionId"=$2 LIMIT 1`, [payload.sessionId, payload.submissionId]);
        if (ar.rows[0]) points = ar.rows[0].points as number;
      } catch {
        /* offline or test without DB — skip intelligence */
      }
      if (topic) {
        await recordAssessmentEvidence({
          studentId,
          sessionId: payload.sessionId,
          topic,
          questionId: payload.response.questionId,
          score: points,
          correlationId: payload.submissionId,
        });
      }
    } catch {
      // never break assessment path
    }
    return session;
  },

  pauseSession(sessionId: string, studentId: string): Promise<AssessmentSession> {
    return assessmentEngine.pauseSession(sessionId, studentId);
  },

  resumeSession(sessionId: string, studentId: string): Promise<AssessmentSession> {
    return assessmentEngine.resumeSession(sessionId, studentId);
  },

  completeSession(sessionId: string, studentId: string): Promise<AssessmentSession> {
    return assessmentEngine.completeSession(sessionId, studentId);
  },

  getResults(sessionId: string, studentId: string): Promise<AssessmentResult> {
    return assessmentEngine.getResults(sessionId, studentId);
  },

  getLatestCompletedResult(studentId: string): Promise<AssessmentResult | null> {
    return assessmentEngine.getLatestCompletedResult(studentId);
  },
};
