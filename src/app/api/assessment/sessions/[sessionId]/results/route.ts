import { NextResponse } from "next/server";
import { mockAssessmentEngine } from "@/services/engines";
import { withStudent } from "@/lib/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ sessionId: string }>;
}

/** GET /api/assessment/sessions/:sessionId/results — the diagnosis for one session. */
export async function GET(req: Request, { params }: Ctx): Promise<NextResponse> {
  const { sessionId } = await params;
  return withStudent(req, async (student) =>
    NextResponse.json(await mockAssessmentEngine.getResults(sessionId, student.id)),
  );
}
