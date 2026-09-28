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
 * POST /api/executions/units/:learningUnitId/start
 *
 * Starts (or resumes, or re-opens after a retry) one unit.
 *
 * Dependency gating is enforced here, not in the UI. The engine resolves the
 * student's active roadmap, checks that it is executable, and checks the
 * milestone and in-milestone prerequisites before it will create a record. A
 * client cannot reach a blocked unit by shaping a payload — there is no
 * payload to shape, and the refusal carries an honest reason
 * (`no_active_roadmap`, `roadmap_not_executable`, `dependencies_unsatisfied`).
 *
 * Idempotent: repeated starts return the same execution record. The database
 * holds a unique constraint on `(roadmapId, learningUnitId)`, so even two
 * concurrent starts produce one record (§20).
 */
export async function POST(req: Request, { params }: Ctx): Promise<NextResponse> {
  const { learningUnitId } = await params;
  if (!learningUnitIdParamSchema.safeParse(learningUnitId).success) {
    return invalidRequestResponse();
  }

  return withStudent(req, async (student) =>
    NextResponse.json(await executionApplication.startLearningUnit(learningUnitId, student.id)),
  );
}
