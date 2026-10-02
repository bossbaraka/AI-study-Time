import { NextResponse } from "next/server";
import { invalidRequestResponse, withStudent } from "@/lib/server/auth/request";
import { getIntelligenceStores } from "@/services/infrastructure/intelligence-stores";
import { gradeTest } from "@/services/tests/test-grading-engine";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1).max(100),
      choiceIndex: z.number().int().min(0).max(20).optional(),
      answer: z.string().max(5000).optional(),
      reasoning: z.string().max(5000).optional(),
    }),
  ).min(1).max(100),
  timeSpentSeconds: z.number().int().min(0).max(86400),
});

/**
 * POST /api/tests/:testId/submit
 * Body: { answers: [{questionId, choiceIndex?, answer?, reasoning?}], timeSpentSeconds }
 * Server grades; client-provided correctness is never accepted.
 * Evidence is also recorded per question for concept-state updates.
 */
export async function POST(req: Request, ctx: { params: Promise<{ testId: string }> }): Promise<NextResponse> {
  const { testId } = await ctx.params;
  if (!testId || testId.length > 100) return invalidRequestResponse();

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();

  return withStudent(req, async (student) => {
    const stores = getIntelligenceStores();
    const def = await stores.tests.findDefinitionById(testId);
    if (!def) return NextResponse.json({ code: "test_not_found" }, { status: 404 });

    // Server-authoritative grading
    const grading = gradeTest(def, parsed.data.answers, parsed.data.timeSpentSeconds);

    const attemptId = `ta_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const attempt = {
      id: attemptId,
      studentId: student.id,
      testId,
      status: "graded",
      score: grading.score,
      timeSpentSeconds: parsed.data.timeSpentSeconds,
      answers: parsed.data.answers,
      gradedAnswers: grading.graded,
      strongTopics: grading.strongTopics,
      needsReviewTopics: grading.needsReviewTopics,
      recommendation: grading.recommendation,
      createdAt: new Date().toISOString(),
    };

    await stores.tests.createAttempt(attempt as unknown as import("@/types/test-attempt").TestAttempt);

    // Record evidence per question (for mastery) — best effort
    try {
      const { getIntelligenceStores: getStores } = await import("@/services/infrastructure/intelligence-stores");
      const { conceptIdForTopic } = await import("@/services/concept/concept-catalog");
      const s = getStores();
      for (const g of grading.graded) {
        const q = def.questions.find((x) => x.id === g.questionId);
        const conceptId = q ? conceptIdForTopic(q.topic) : null;
        const score01 = g.pointsPossible === 0 ? 0 : g.pointsEarned / g.pointsPossible;
        await s.evidences.create(student.id, {
          conceptId: conceptId ?? null,
          kind: "quiz_result",
          payload: { questionId: g.questionId, topic: q?.topic, correct: g.correct, explanation: q?.explanation },
          score: score01,
          timeSpentSeconds: Math.round(parsed.data.timeSpentSeconds / grading.graded.length),
          testAttemptId: attemptId,
        });
        if (conceptId) {
          const { masteryEngine } = await import("@/services/mastery/mastery-engine");
          const prev = await s.conceptStates.get(student.id, conceptId);
          // Reuse the evidence we just created — fetch it? Instead apply with a synthetic evidence object to keep mastery in sync
          const synthetic = {
            id: `syn_${g.questionId}_${attemptId}`,
            studentId: student.id,
            conceptId,
            kind: "quiz_result" as const,
            payload: { questionId: g.questionId },
            score: score01,
            timeSpentSeconds: Math.round(parsed.data.timeSpentSeconds / grading.graded.length),
            attemptCount: 1,
            hintUsed: false,
            hintCount: 0,
            learningUnitId: null,
            roadmapId: null,
            assessmentSessionId: null,
            testAttemptId: attemptId,
            immutable: false,
            version: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const { next } = masteryEngine.apply(synthetic as unknown as import("@/types/evidence").Evidence, prev ?? null);
          const withId = { ...next, id: (prev as unknown as { id?: string })?.id ?? `cs_${student.id}_${conceptId}` } as unknown as import("@/types/concept-state").ConceptState;
          await s.conceptStates.upsert(withId as import("@/types/concept-state").ConceptState & { id: string });
        }
      }
      await s.learningEvents.append({
        studentId: student.id,
        type: "TEST_COMPLETED",
        source: "api",
        entityType: "TestAttempt",
        entityId: attemptId,
        payload: { testId, score: grading.score, strongTopics: grading.strongTopics, needsReviewTopics: grading.needsReviewTopics },
      }).catch(() => {});
    } catch {
      // Evidence failure must not break grading
    }

    return NextResponse.json(attempt, { status: 201 });
  });
}
