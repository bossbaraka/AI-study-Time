import { NextResponse } from "next/server";
import { invalidRequestResponse, withStudent } from "@/lib/server/auth/request";
import { goalIdParamSchema, lockGoalSchema } from "@/schemas/goal-api";
import { goalApplication } from "@/services/application/goal-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Ctx {
  params: Promise<{ goalId: string }>;
}

/**
 * POST /api/goals/:goalId/lock
 *
 * A named domain transition, not a status write. The client asks to lock; the
 * state machine decides whether that is legal from the current state, and a
 * goal with open validation errors refuses with `validation_failed`.
 *
 * Idempotency: the request carries a client-generated key, and the database
 * holds a unique constraint on `(studentId, lockIdempotencyKey)`. Two
 * concurrent locks therefore cannot both commit — one replays, the other is
 * told. That is what makes a double-click safe, and it is enforced below the
 * application layer rather than by an `if` in it (§20).
 */
export async function POST(req: Request, { params }: Ctx): Promise<NextResponse> {
  const { goalId } = await params;
  if (!goalIdParamSchema.safeParse(goalId).success) return invalidRequestResponse();

  const parsed = lockGoalSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();

  return withStudent(req, async (student) =>
    NextResponse.json(
      await goalApplication.lockGoal(goalId, parsed.data.idempotencyKey, student.id),
    ),
  );
}
