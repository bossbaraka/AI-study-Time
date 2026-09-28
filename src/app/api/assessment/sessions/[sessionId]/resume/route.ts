import { NextResponse } from "next/server";
import { mockAssessmentEngine } from "@/services/engines.server";
import { withStudent } from "@/lib/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ sessionId: string }>;
}

/** POST /api/assessment/sessions/:sessionId/resume — ownership enforced by the engine. */
export async function POST(req: Request, { params }: Ctx): Promise<NextResponse> {
  const { sessionId } = await params;
  return withStudent(req, async (student) =>
    NextResponse.json(await mockAssessmentEngine.resumeSession(sessionId, student.id)),
  );
}
