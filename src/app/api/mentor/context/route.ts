import { NextResponse } from "next/server";
import { withStudent } from "@/lib/server/auth/request";
import { getIntelligenceStores } from "@/services/infrastructure/intelligence-stores";
import { buildMentorContext } from "@/services/mentor/mentor-context-builder";
import { getAdaptiveDecision } from "@/services/application/intelligence-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/mentor/context
 * Real learner context for the mentor: goal, roadmap, unit, concept
 * states, recent evidence, behavior, adaptive recommendation.
 * All derived server-side — the LLM never invents this.
 */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async (student) => {
    const stores = getIntelligenceStores();
    const [states, evidence, events, adaptive] = await Promise.all([
      stores.conceptStates.listByStudent(student.id),
      stores.evidences.listByStudent(student.id, 10),
      stores.learningEvents.listByStudent(student.id, 50),
      getAdaptiveDecision(student.id).catch(() => null),
    ]);

    // Fetch goal/roadmap titles via pg if available
    let goalTitle: string | null = null;
    let roadmapTitle: string | null = null;
    let currentUnitTitle: string | null = null;
    try {
      const { getPool } = await import("@/services/infrastructure/pg-pool");
      const pool = getPool();
      const g = await pool.query(`SELECT "desiredOutcome" FROM "Goal" WHERE "studentId"=$1 AND "status" IN ('locked','active','discovered','validated') ORDER BY "updatedAt" DESC LIMIT 1`, [student.id]);
      if (g.rows[0]) goalTitle = g.rows[0].desiredOutcome as string;
      const r = await pool.query(`SELECT "title" FROM "Roadmap" WHERE "studentId"=$1 AND "status"='active' ORDER BY "updatedAt" DESC LIMIT 1`, [student.id]);
      if (r.rows[0]) roadmapTitle = r.rows[0].title as string;
      // Current unit via execution view: pick the first in_progress
      const u = await pool.query(`SELECT "learningUnitId" FROM "LearningUnitExecution" WHERE "studentId"=$1 AND "status"='in_progress' LIMIT 1`, [student.id]);
      if (u.rows[0]) {
        const lu = await pool.query(`SELECT "title" FROM "LearningUnit" WHERE "unitId"=$1 LIMIT 1`, [u.rows[0].learningUnitId]);
        if (lu.rows[0]) currentUnitTitle = lu.rows[0].title as string;
      }
    } catch {
      // best effort
    }

    const context = buildMentorContext({
      studentId: student.id,
      goalTitle,
      roadmapTitle,
      currentUnitTitle,
      conceptStates: states,
      recentEvidence: evidence,
      recentEvents: events,
      adaptiveDecision: adaptive,
    });

    // Also emit a learning event for mentor interaction start (lightweight)
    await stores.learningEvents.append({
      studentId: student.id,
      type: "MENTOR_INTERACTION",
      source: "api",
      entityType: "MentorContext",
      entityId: student.id,
      payload: { kind: "context_view" },
    }).catch(() => {});

    return NextResponse.json(context);
  });
}
