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
 * GET /api/roadmaps/:roadmapId
 *
 * A roadmap with its full milestone and unit tree. Ownership is the engine's
 * decision: a foreign roadmap answers `roadmap_not_found`, so existence is
 * never disclosed — a different (and deliberately inconsistent) choice from
 * the goal domain's 403, preserved here rather than silently unified (§12).
 */
export async function GET(req: Request, { params }: Ctx): Promise<NextResponse> {
  const { roadmapId } = await params;
  if (!roadmapIdParamSchema.safeParse(roadmapId).success) return invalidRequestResponse();

  return withStudent(req, async (student) =>
    NextResponse.json(await roadmapApplication.getRoadmap(roadmapId, student.id)),
  );
}
