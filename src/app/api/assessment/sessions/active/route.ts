import { NextResponse } from "next/server";
import { mockAssessmentEngine } from "@/services/engines.server";
import { withStudent } from "@/lib/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/assessment/sessions/active — the caller's own unfinished session. */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async (student) =>
    NextResponse.json(await mockAssessmentEngine.getActiveSession(student.id)),
  );
}
