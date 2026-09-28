import { NextResponse } from "next/server";
import { assessmentApplication } from "@/services/application/assessment-application";
import { invalidRequestResponse, withStudent } from "@/lib/server/auth/request";
import { assessmentSessionIdParamSchema, submitAnswerSchema } from "@/schemas/assessment-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ sessionId: string }>;
}

/**
 * POST /api/assessment/sessions/:sessionId/answers
 *
 * Server-authoritative evaluation. The client submits its RESPONSE
 * (optionId or free text); the engine holds the answer key and decides
 * the score. A client-supplied `correct` flag is not part of the schema
 * and would be stripped by Zod.
 */
export async function POST(req: Request, { params }: Ctx): Promise<NextResponse> {
  const parsed = submitAnswerSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();
  const { sessionId } = await params;
  if (!assessmentSessionIdParamSchema.safeParse(sessionId).success) return invalidRequestResponse();
  if (parsed.data.sessionId !== sessionId) return invalidRequestResponse();

  return withStudent(req, async (student) =>
    NextResponse.json(await assessmentApplication.submitAnswer(parsed.data, student.id)),
  );
}
