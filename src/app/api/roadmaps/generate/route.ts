import { NextResponse } from "next/server";
import { invalidRequestResponse, withStudent } from "@/lib/server/auth/request";
import { generateRoadmapSchema } from "@/schemas/roadmap-api";
import { roadmapApplication } from "@/services/application/roadmap-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/roadmaps/generate
 *
 * Plans a roadmap for a LOCKED goal. The body carries the goal id and nothing
 * else — no milestones, no hours, no capability selection. The planner derives
 * the plan from the locked goal plus the diagnosis, and a structure gate
 * rejects it before anything is persisted. Letting the client pass plan
 * parameters would let it bypass the feasibility check that is the planner's
 * entire purpose.
 *
 * Idempotent on `studentId:goalId:goalVersion:engineVersion`, enforced by a
 * unique constraint on `generationKey`. Repeated clicks — and concurrent ones
 * — produce one roadmap, and the response says whether it was created or
 * replayed.
 *
 * The engine owns the goal lookup, the ownership check on it, the supersede of
 * any previous plan and the publish, in one transaction.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const parsed = generateRoadmapSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();

  return withStudent(req, async (student) => {
    const result = await roadmapApplication.generateRoadmap(parsed.data.goalId, student.id);
    // 201 for a newly created plan, 200 for an idempotent replay. The client
    // can tell the two apart from `created`, and the status agrees with it.
    return NextResponse.json(result, { status: result.created ? 201 : 200 });
  });
}
