import { NextResponse } from "next/server";
import { mockAssessmentEngine } from "@/services/engines";
import { withStudent } from "@/lib/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/assessment/results/latest
 *
 * The signed-in student's most recent completed diagnosis — the STEP 5
 * goal-discovery input. Resolved from the session identity, so one
 * student can never read another's diagnosis.
 */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async (student) =>
    NextResponse.json(await mockAssessmentEngine.getLatestCompletedResult(student.id)),
  );
}
