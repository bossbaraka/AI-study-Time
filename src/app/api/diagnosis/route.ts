import { NextResponse } from "next/server";
import { withStudent } from "@/lib/server/auth/request";
import { getDiagnoses } from "@/services/application/intelligence-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/diagnosis
 * Concept-level diagnosis. Each row explains *what* the gap is
 * (retrieval, retention, transfer, misconception, prerequisite) —
 * not "the student doesn't understand."
 */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async (student) => {
    const diagnoses = await getDiagnoses(student.id);
    return NextResponse.json(diagnoses);
  });
}
