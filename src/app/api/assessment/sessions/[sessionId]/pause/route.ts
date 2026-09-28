import { NextResponse } from "next/server";
import { assessmentApplication } from "@/services/application/assessment-application";
import { invalidRequestResponse, withStudent } from "@/lib/server/auth/request";
import { assessmentSessionIdParamSchema } from "@/schemas/assessment-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ sessionId: string }>;
}

/** POST /api/assessment/sessions/:sessionId/pause — ownership enforced by the engine. */
export async function POST(req: Request, { params }: Ctx): Promise<NextResponse> {
  const { sessionId } = await params;
  if (!assessmentSessionIdParamSchema.safeParse(sessionId).success) return invalidRequestResponse();
  return withStudent(req, async (student) =>
    NextResponse.json(await assessmentApplication.pauseSession(sessionId, student.id)),
  );
}
