import { NextResponse } from "next/server";
import { withStudent } from "@/lib/server/auth/request";
import { getMasteryView } from "@/services/application/intelligence-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/mastery
 * Evidence-backed mastery: each row is a ConceptState-derived view,
 * not a hardcoded array. When the student has no evidence, the list
 * is empty — never fake percentages.
 */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async (student) => {
    const mastery = await getMasteryView(student.id);
    return NextResponse.json(mastery);
  });
}
