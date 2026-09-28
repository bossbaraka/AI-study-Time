import { NextResponse } from "next/server";
import { generateAssessmentQuestions } from "@/lib/server/ai/question-generator";
import { AuthGatewayError } from "@/lib/server/auth/gateway";
import { checkRate } from "@/lib/server/auth/rate-limit";
import { invalidRequestResponse, withStudent } from "@/lib/server/auth/request";
import { createSessionSchema } from "@/schemas/assessment-api";
import { mockAssessmentEngine } from "@/services/engines.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/assessment/sessions
 *
 * Creates a diagnostic session for the signed-in student.
 *
 * SECURITY: question generation happens HERE. The generated bank carries
 * `correctOptionId` / keyword answer keys; it is handed to the engine and
 * stored on the session, and only the public question projection is ever
 * returned. No answer key crosses this boundary — the previous
 * `/api/assessment/generate` endpoint returned the whole bank to the
 * browser and has been removed.
 *
 * Ownership: `student.id` comes from the session cookie, never the body.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const parsed = createSessionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();

  return withStudent(req, async (student) => {
    // Session creation can trigger a paid model call — bound it per student.
    const rate = checkRate(`assessment:create:${student.id}`, 12);
    if (!rate.ok) throw new AuthGatewayError("rate_limited", 429);

    const profile = parsed.data.profile;
    const customData = profile ? await generateAssessmentQuestions(profile) : undefined;

    const session = await mockAssessmentEngine.createSession(student.id, profile, customData);
    return NextResponse.json(session, { status: 201 });
  });
}
