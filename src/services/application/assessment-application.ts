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

  submitAnswer(payload: SubmitAnswerPayload, studentId: string): Promise<AssessmentSession> {
    return assessmentEngine.submitAnswer(payload, studentId);
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
