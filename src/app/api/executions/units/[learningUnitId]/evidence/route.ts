import { NextResponse } from "next/server";
import { invalidRequestResponse, withStudent } from "@/lib/server/auth/request";
import { evidenceInputSchema, learningUnitIdParamSchema } from "@/schemas/execution-api";
import { executionApplication } from "@/services/application/execution-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ learningUnitId: string }>;
}

/**
 * POST /api/executions/units/:learningUnitId/evidence
 *
 * Records the student's evidence: solution text and reasoning. That is all the
 * client sends.
 *
 * **There is no verdict in the request and none in the response's authority.**
 * The evidence policy derives `passed | needs_review | failed` from the text
 * during `evaluate`. A client cannot submit a pass, and cannot submit a
 * `correct` flag — the schema has exactly two fields.
 *
 * Empty evidence is rejected by the DOMAIN (`evidence_invalid`, 422), not by
 * this boundary. The schema bounds length only, so the engine's own code
 * reaches the client instead of a generic 400 (§12).
 */
export async function POST(req: Request, { params }: Ctx): Promise<NextResponse> {
  const { learningUnitId } = await params;
  if (!learningUnitIdParamSchema.safeParse(learningUnitId).success) {
    return invalidRequestResponse();
  }

  const parsed = evidenceInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();

  return withStudent(req, async (student) =>
    NextResponse.json(
      await executionApplication.submitEvidence(learningUnitId, parsed.data, student.id),
    ),
  );
}
