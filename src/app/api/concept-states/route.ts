import { NextResponse } from "next/server";
import { withStudent } from "@/lib/server/auth/request";
import { getConceptStates } from "@/services/application/intelligence-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/concept-states
 * Per-student decomposed learner state. The server is the truth —
 * the client never supplies these vectors.
 */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async (student) => {
    const states = await getConceptStates(student.id);
    return NextResponse.json(states);
  });
}
