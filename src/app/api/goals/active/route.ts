import { NextResponse } from "next/server";
import { withStudent } from "@/lib/server/auth/request";
import { goalApplication } from "@/services/application/goal-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/goals/active
 *
 * The student's current live goal, or `null` when they have none. `null` is a
 * normal answer, not an error: the discovery flow depends on distinguishing
 * "no goal yet" from "request failed".
 */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async (student) =>
    NextResponse.json(await goalApplication.getActiveGoal(student.id)),
  );
}
