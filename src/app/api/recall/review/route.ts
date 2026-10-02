import { NextResponse } from "next/server";
import { invalidRequestResponse, withStudent } from "@/lib/server/auth/request";
import { reviewRecall } from "@/services/application/intelligence-application";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  conceptId: z.string().min(1).max(100),
  quality: z.number().int().min(0).max(5),
});

/**
 * POST /api/recall/review
 * Body: { conceptId, quality: 0..5 }
 * Server grades recall performance and reschedules. The client never
 * computes intervalDays or easeFactor.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();

  return withStudent(req, async (student) => {
    try {
      const result = await reviewRecall(student.id, parsed.data.conceptId, parsed.data.quality);
      return NextResponse.json(result);
    } catch (error) {
      const msg = (error as Error).message;
      if (msg === "schedule_not_found") return NextResponse.json({ code: "schedule_not_found" }, { status: 404 });
      throw error;
    }
  });
}
