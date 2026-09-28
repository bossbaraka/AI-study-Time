import { NextResponse } from "next/server";
import { assessmentApplication } from "@/services/application/assessment-application";
import { invalidRequestResponse, withStudent } from "@/lib/server/auth/request";
import { assessmentSessionIdParamSchema } from "@/schemas/assessment-api";

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
  if (!assessmentSessionIdParamSchema.safeParse(sessionId).success) return invalidRequestResponse();
  return withStudent(req, async (student) =>
    NextResponse.json(await assessmentApplication.getSession(sessionId, student.id)),
  );
}
