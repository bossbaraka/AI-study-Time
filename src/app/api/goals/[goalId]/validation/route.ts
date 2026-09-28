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
 * GET /api/goals/:goalId/validation
 *
 * Re-runs the quality rules without mutating the goal. Read-only: it neither
 * bumps `version` nor changes status, so the client can re-check after an
 * offline edit without creating a write.
 */
export async function GET(req: Request, { params }: Ctx): Promise<NextResponse> {
  const { goalId } = await params;
  if (!goalIdParamSchema.safeParse(goalId).success) return invalidRequestResponse();

  return withStudent(req, async (student) =>
    NextResponse.json(await goalApplication.validateGoal(goalId, student.id)),
  );
}
