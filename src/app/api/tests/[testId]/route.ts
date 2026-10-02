import { NextResponse } from "next/server";
import { withStudent } from "@/lib/server/auth/request";
import { getIntelligenceStores } from "@/services/infrastructure/intelligence-stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tests/:testId
 * One test definition — public projection (no answer key).
 */
export async function GET(req: Request, ctx: { params: Promise<{ testId: string }> }): Promise<NextResponse> {
  const { testId } = await ctx.params;
  if (!testId || testId.length > 100) return NextResponse.json({ code: "invalid" }, { status: 400 });

  return withStudent(req, async () => {
    const stores = getIntelligenceStores();
    const def = await stores.tests.findDefinitionById(testId);
    if (!def) return NextResponse.json({ code: "test_not_found" }, { status: 404 });
    const pub = {
      ...def,
      questions: def.questions.map((q) => ({
        id: q.id,
        kind: q.kind,
        prompt: q.prompt,
        choices: q.choices,
        explanation: q.explanation,
        topic: q.topic,
        points: q.points,
      })),
    };
    return NextResponse.json(pub);
  });
}
