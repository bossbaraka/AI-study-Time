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
 * GET /api/executions/units/:learningUnitId/context
 *
 * Everything the learn screen needs for one unit: the roadmap and milestone it
 * sits in, the unit itself, the student's execution record (null until they
 * start), the derived status, and what unlocks next.
 *
 * The unit id is a DOMAIN id that repeats across roadmap versions, so it is
 * resolved against the student's own active roadmap — not looked up globally.
 * A unit that is not in this student's current plan is unavailable, which is
 * also what stops one student from reading another's unit by guessing an id.
 */
export async function GET(req: Request, { params }: Ctx): Promise<NextResponse> {
  const { learningUnitId } = await params;
  if (!learningUnitIdParamSchema.safeParse(learningUnitId).success) {
    return invalidRequestResponse();
  }

  return withStudent(req, async (student) =>
    NextResponse.json(await executionApplication.getUnitContext(learningUnitId, student.id)),
  );
}
