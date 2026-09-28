import { NextResponse } from "next/server";
import { withStudent } from "@/lib/server/auth/request";
import { roadmapApplication } from "@/services/application/roadmap-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/roadmaps/active
 *
 * The student's live roadmap (draft/active/paused), or `null` before any plan
 * has been generated. `null` is the signal the roadmap flow uses to offer
 * generation — it is not an error.
 */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async (student) =>
    NextResponse.json(await roadmapApplication.getActiveRoadmap(student.id)),
  );
}
