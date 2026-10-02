import { NextResponse } from "next/server";
import { withStudent } from "@/lib/server/auth/request";
import { getIntelligenceStores } from "@/services/infrastructure/intelligence-stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/privacy/export
 * Returns the authenticated student's own data as JSON (bounded).
 */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async (student) => {
    const stores = getIntelligenceStores();
    const poolModule = await import("@/services/infrastructure/pg-pool").catch(() => null);
    let goals: unknown[] = [];
    let roadmaps: unknown[] = [];
    try {
      if (poolModule) {
        const pool = poolModule.getPool();
        const g = await pool.query(`SELECT * FROM "Goal" WHERE "studentId"=$1 ORDER BY "createdAt" DESC LIMIT 50`, [student.id]);
        goals = g.rows;
        const r = await pool.query(`SELECT * FROM "Roadmap" WHERE "studentId"=$1 ORDER BY "createdAt" DESC LIMIT 20`, [student.id]);
        roadmaps = r.rows;
      }
    } catch { /* fallback to empty */ }

    const [states, evidences, events, attempts, recallSchedules] = await Promise.all([
      stores.conceptStates.listByStudent(student.id).catch(() => []),
      stores.evidences.listByStudent(student.id, 100).catch(() => []),
      stores.learningEvents.listByStudent(student.id, 100).catch(() => []),
      stores.tests.listAttemptsByStudent(student.id).catch(() => []),
      stores.recallSchedules.listByStudent(student.id).catch(() => []),
    ]);

    return NextResponse.json({
      user: { id: student.id, email: student.email, role: student.role },
      goals,
      roadmaps,
      conceptStates: states,
      evidences,
      learningEvents: events,
      testAttempts: attempts,
      recallSchedules,
      exportedAt: new Date().toISOString(),
    });
  });
}
