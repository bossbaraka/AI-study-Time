import { NextResponse } from "next/server";
import { withStudent } from "@/lib/server/auth/request";
import { getAdaptiveDecision } from "@/services/application/intelligence-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/adaptive/next
 * Deterministic NextLearningAction. Includes "Why am I seeing this?"
 * reason so the UI can be transparent.
 *
 * Query params (optional): goalId, roadmapId, currentUnitId — server
 * validates they belong to the caller; absent is honest (null).
 */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async (student) => {
    const url = new URL(req.url);
    const decision = await getAdaptiveDecision(student.id, {
      goalId: url.searchParams.get("goalId"),
      roadmapId: url.searchParams.get("roadmapId"),
      currentUnitId: url.searchParams.get("currentUnitId"),
    });
    return NextResponse.json(decision);
  });
}
