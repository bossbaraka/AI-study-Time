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
 * POST /api/roadmaps/:roadmapId/resume
 *
 * The counterpart to `/pause`: a named transition guarded by the roadmap state
 * machine. Whether resuming from the current state is legal is the machine's
 * answer, not the caller's — an illegal one is refused with
 * `invalid_transition` rather than being coerced into `active`.
 */
export async function POST(req: Request, { params }: Ctx): Promise<NextResponse> {
  const { roadmapId } = await params;
  if (!roadmapIdParamSchema.safeParse(roadmapId).success) return invalidRequestResponse();

  return withStudent(req, async (student) =>
    NextResponse.json(await roadmapApplication.resumeRoadmap(roadmapId, student.id)),
  );
}
