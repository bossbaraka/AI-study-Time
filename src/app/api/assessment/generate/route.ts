import { NextResponse } from "next/server";
import { generateAssessmentQuestions } from "@/lib/server/ai/question-generator";
import type { StudentAssessmentProfile } from "@/types/assessment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Partial<StudentAssessmentProfile> | null;

    if (!body || !body.targetSubject || typeof body.targetSubject !== "string") {
      return NextResponse.json(
        { error: "Target subject is required" },
        { status: 400 },
      );
    }

    const profile: StudentAssessmentProfile = {
      targetSubject: body.targetSubject.trim(),
      age: typeof body.age === "number" && body.age > 4 ? body.age : 16,
      stage: body.stage || "high_school",
    };

    const result = await generateAssessmentQuestions(profile);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[API /assessment/generate] error:", error);
    return NextResponse.json(
      { error: "Failed to generate assessment questions" },
      { status: 500 },
    );
  }
}
