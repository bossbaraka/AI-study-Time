import { NextResponse } from "next/server";
import { invalidRequestResponse, withStudent } from "@/lib/server/auth/request";
import { createGoalSchema } from "@/schemas/goal-api";
import { goalApplication } from "@/services/application/goal-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/goals
 *
 * Creates the signed-in student's goal, or replays an earlier creation that
 * carried the same `idempotencyKey`.
 *
 * Ownership: `student.id` comes from the session cookie. The body carries
 * only the student's own input and a replay key — a `studentId` field would
 * be stripped by the schema, and is never read.
 *
 * The diagnosis snapshot is attached server-side by the application service;
 * the client cannot supply or influence it.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const parsed = createGoalSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();

  return withStudent(req, async (student) => {
    const result = await goalApplication.createGoal(
      parsed.data.input,
      parsed.data.idempotencyKey,
      student.id,
    );
    return NextResponse.json(result, { status: 201 });
  });
}
