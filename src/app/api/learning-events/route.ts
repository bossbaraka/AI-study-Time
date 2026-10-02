import { NextResponse } from "next/server";
import { invalidRequestResponse, withStudent } from "@/lib/server/auth/request";
import { getIntelligenceStores } from "@/services/infrastructure/intelligence-stores";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  type: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

/**
 * GET /api/learning-events?type=&limit=
 * Student's own event stream (bounded). Validates type against allowlist.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const parsed = querySchema.safeParse({ type: url.searchParams.get("type") ?? undefined, limit: url.searchParams.get("limit") ?? undefined });
  if (!parsed.success) return invalidRequestResponse();

  return withStudent(req, async (student) => {
    const stores = getIntelligenceStores();
    const limit = parsed.data.limit ?? 50;
    if (parsed.data.type) {
      try {
        const items = await stores.learningEvents.listByStudentAndType(student.id, parsed.data.type, limit);
        return NextResponse.json(items);
      } catch {
        return invalidRequestResponse();
      }
    }
    const items = await stores.learningEvents.listByStudent(student.id, limit);
    return NextResponse.json(items);
  });
}
