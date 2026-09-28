import { NextResponse } from "next/server";
import { mockAssessmentEngine } from "@/services/engines.server";
import { withStudent } from "@/lib/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ sessionId: string }>;
}

/**
 * GET /api/assessment/sessions/:sessionId
 *
 * A session owned by another student is indistinguishable from a missing
 * one — the engine raises `session_not_found` (404) for both.
 */
export async function GET(req: Request, { params }: Ctx): Promise<NextResponse> {
  const { sessionId } = await params;
  return withStudent(req, async (student) =>
    NextResponse.json(await mockAssessmentEngine.getSession(sessionId, student.id)),
  );
}
