import { NextResponse } from "next/server";
import { withStudent } from "@/lib/server/auth/request";
import { getBehaviorInsights } from "@/services/application/intelligence-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/behavior
 * Observable learning behavior only — never personality or clinical language.
 */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async (student) => {
    const insights = await getBehaviorInsights(student.id);
    return NextResponse.json(insights);
  });
}
