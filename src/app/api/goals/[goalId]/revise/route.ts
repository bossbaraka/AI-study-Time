import { NextResponse } from "next/server";
import { invalidRequestResponse, withStudent } from "@/lib/server/auth/request";
import { goalIdParamSchema } from "@/schemas/goal-api";
import { goalApplication } from "@/services/application/goal-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ goalId: string }>;
}

/**
 * POST /api/goals/:goalId/revise
 *
 * The only way to edit a locked goal. It does not mutate the goal in place:
 * the original becomes `revised` (history is kept) and a fresh editable copy
 * appears, carrying `revisesGoalId` back to its predecessor.
 *
 * Two aggregates are written, so the engine commits them in one transaction.
 * A partial write would leave the student with no editable goal at all.
 *
 * No body: the transition is fully determined by the goal's current state.
 */
export async function POST(req: Request, { params }: Ctx): Promise<NextResponse> {
  const { goalId } = await params;
  if (!goalIdParamSchema.safeParse(goalId).success) return invalidRequestResponse();

  return withStudent(req, async (student) =>
    NextResponse.json(await goalApplication.reviseGoal(goalId, student.id), { status: 201 }),
  );
}
