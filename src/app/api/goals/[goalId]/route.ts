import { NextResponse } from "next/server";
import { invalidRequestResponse, withStudent } from "@/lib/server/auth/request";
import { goalIdParamSchema, goalRefinePatchSchema } from "@/schemas/goal-api";
import { goalApplication } from "@/services/application/goal-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ goalId: string }>;
}

/**
 * GET /api/goals/:goalId
 *
 * Ownership is enforced by the engine: a goal belonging to another student is
 * indistinguishable from one that does not exist, so existence is never
 * disclosed. The engine answers 403 for a foreign goal and 404 for a missing
 * one — that split is the goal domain's existing contract and is preserved
 * here rather than normalised (§12).
 */
export async function GET(req: Request, { params }: Ctx): Promise<NextResponse> {
  const { goalId } = await params;
  if (!goalIdParamSchema.safeParse(goalId).success) return invalidRequestResponse();

  return withStudent(req, async (student) =>
    NextResponse.json(await goalApplication.getGoal(goalId, student.id)),
  );
}

/**
 * PATCH /api/goals/:goalId
 *
 * Refines an EDITABLE goal. This is not a general update: the schema has no
 * `status`, no `version` and no `studentId`, so the only thing a client can
 * change is the discovery input. Whether the goal is editable at all is the
 * state machine's decision, not the caller's — a locked goal refuses with
 * `invalid_transition`, and revising it requires the explicit `/revise`
 * transition.
 */
export async function PATCH(req: Request, { params }: Ctx): Promise<NextResponse> {
  const { goalId } = await params;
  if (!goalIdParamSchema.safeParse(goalId).success) return invalidRequestResponse();

  const parsed = goalRefinePatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();

  return withStudent(req, async (student) =>
    NextResponse.json(await goalApplication.updateGoal(goalId, parsed.data, student.id)),
  );
}
