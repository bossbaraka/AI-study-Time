import { NextResponse } from "next/server";
import { withStudent } from "@/lib/server/auth/request";
import { getRecallDue } from "@/services/application/intelligence-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/recall/schedules?due=true
 * Lists the student's recall schedules. With `due=true`, only those
 * whose dueAt <= now are returned (today's work). Without it, all
 * schedules are returned for progress display.
 */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async (student) => {
    const url = new URL(req.url);
    const dueOnly = url.searchParams.get("due") === "true";
    const all = await getRecallDue(student.id);
    if (dueOnly) {
      const now = new Date().toISOString();
      const due = all.filter(({ schedule }) => schedule.dueAt <= now);
      return NextResponse.json(due);
    }
    // For non-due view, we return all via the same shape
    // (caller can derive dueToday count from schedule.dueAt)
    const stores = (await import("@/services/infrastructure/intelligence-stores")).getIntelligenceStores();
    const allSchedules = await stores.recallSchedules.listByStudent(student.id);
    const concepts = await stores.concepts.list();
    const byId = new Map(concepts.map((c) => [c.id, c]));
    const mapped = allSchedules.map((s) => ({ schedule: s, concept: byId.get(s.conceptId) ?? null }));
    return NextResponse.json(mapped);
  });
}
