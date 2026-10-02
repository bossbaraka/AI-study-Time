import { NextResponse } from "next/server";
import { withStudent } from "@/lib/server/auth/request";
import { getIntelligenceStores } from "@/services/infrastructure/intelligence-stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tests
 * Server-owned test definitions. The answer key never leaves the server;
 * the public projection is questions without correctChoiceIndex/rubric secrets
 * for multiple_choice where the key must stay internal? However for
 * study the explanation is useful after grading — but before submission
 * the client must not see correctChoiceIndex. We strip it for the list.
 */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async () => {
    const stores = getIntelligenceStores();
    const defs = await stores.tests.listDefinitions();
    // Public projection: strip correctChoiceIndex and rubric before submission state is irrelevant here;
    // but we keep it stripped for list to prevent pre-answer cheating. Full grading happens server-side.
    const pub = defs.map((d) => ({
      ...d,
      questions: d.questions.map((q) => ({
        id: q.id,
        kind: q.kind,
        prompt: q.prompt,
        choices: q.choices,
        // correctChoiceIndex intentionally omitted
        explanation: q.explanation,
        topic: q.topic,
        points: q.points,
      })),
    }));
    return NextResponse.json(pub);
  });
}
