import { NextResponse } from "next/server";
import { invalidRequestResponse, withStudent } from "@/lib/server/auth/request";
import { learningUnitIdParamSchema } from "@/schemas/execution-api";
import { executionApplication } from "@/services/application/execution-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ learningUnitId: string }>;
}

/**
 * POST /api/executions/units/:learningUnitId/evaluate
 *
 * Runs the deterministic development evaluation over the submitted evidence and
 * records `passed | needs_review | failed`.
 *
 * The verdict is the engine's, derived from the stored evidence against a
 * published evidence policy — never a client input, and never an LLM call. A
 * passed unit is what unlocks its dependents, so this endpoint is the gate
 * that a client must not be able to open for itself.
 *
 * Repeated evaluation replays the same deterministic result rather than
 * re-rolling it.
 */
export async function POST(req: Request, { params }: Ctx): Promise<NextResponse> {
  const { learningUnitId } = await params;
  if (!learningUnitIdParamSchema.safeParse(learningUnitId).success) {
    return invalidRequestResponse();
  }

  return withStudent(req, async (student) =>
    NextResponse.json(await executionApplication.evaluateExecution(learningUnitId, student.id)),
  );
}
