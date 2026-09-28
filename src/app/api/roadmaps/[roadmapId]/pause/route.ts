import { NextResponse } from "next/server";
import { invalidRequestResponse, withStudent } from "@/lib/server/auth/request";
import { roadmapIdParamSchema } from "@/schemas/roadmap-api";
import { roadmapApplication } from "@/services/application/roadmap-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ roadmapId: string }>;
}

/**
 * POST /api/roadmaps/:roadmapId/pause
 *
 * A named transition. Pausing is not a field the client writes: the state
 * machine refuses any transition that is not legal from the current state, so
 * a completed or superseded roadmap cannot be "paused" back to life.
 *
 * Side effect worth stating: a paused roadmap is not executable. Unit starts
 * against it fail with `unit_unavailable:roadmap_not_executable` rather than
 * quietly recording progress nobody asked for.
 */
export async function POST(req: Request, { params }: Ctx): Promise<NextResponse> {
  const { roadmapId } = await params;
  if (!roadmapIdParamSchema.safeParse(roadmapId).success) return invalidRequestResponse();

  return withStudent(req, async (student) =>
    NextResponse.json(await roadmapApplication.pauseRoadmap(roadmapId, student.id)),
  );
}
