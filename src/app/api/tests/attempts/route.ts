import { NextResponse } from "next/server";
import { withStudent } from "@/lib/server/auth/request";
import { getIntelligenceStores } from "@/services/infrastructure/intelligence-stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/tests/attempts
 * Student's own graded attempts (bounded). Never another student's.
 */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async (student) => {
    const stores = getIntelligenceStores();
    const attempts = await stores.tests.listAttemptsByStudent(student.id);
    return NextResponse.json(attempts);
  });
}
