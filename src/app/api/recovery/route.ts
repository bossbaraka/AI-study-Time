import { NextResponse } from "next/server";
import { withStudent } from "@/lib/server/auth/request";
import { getRecoveryPlans } from "@/services/application/intelligence-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/recovery
 * Deterministic recovery strategies derived from diagnosis. Empty means
 * no intervention is needed — not a fake "you're doing great" block.
 */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async (student) => {
    const plans = await getRecoveryPlans(student.id);
    return NextResponse.json(plans);
  });
}
