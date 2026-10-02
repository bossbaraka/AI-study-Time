import { NextResponse } from "next/server";
import { withStudent } from "@/lib/server/auth/request";
import { prisma } from "@/lib/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DELETE /api/privacy/delete
 * Cascading account deletion. The User row is the owner; all
 * student-owned aggregates cascade via FK onDelete: Cascade.
 * AuditEvents are retained with actorId nulled (handled by Prisma SET NULL).
 */
export async function DELETE(req: Request): Promise<NextResponse> {
  return withStudent(req, async (student) => {
    try {
      // Intelligence stores that are pg-backed will cascade via User FK,
      // but memory stores need explicit clear for test isolation — not needed in prod.
      await prisma.user.delete({ where: { id: student.id } });
      // Also clear intelligence pg stores for this student (explicit, in case FK not yet cascaded for new tables via pg Pool separate)
      try {
        const { getPool } = await import("@/services/infrastructure/pg-pool");
        const pool = getPool();
        await pool.query(`DELETE FROM "Evidence" WHERE "studentId"=$1`, [student.id]);
        await pool.query(`DELETE FROM "ConceptState" WHERE "studentId"=$1`, [student.id]);
        await pool.query(`DELETE FROM "RecallSchedule" WHERE "studentId"=$1`, [student.id]);
        await pool.query(`DELETE FROM "TestAttempt" WHERE "studentId"=$1`, [student.id]);
        await pool.query(`DELETE FROM "LearningEvent" WHERE "studentId"=$1`, [student.id]);
      } catch { /* best effort */ }
      // Clear cookie session by revoking — client will clear on next 401, but we also return Set-Cookie
      const res = NextResponse.json({ deleted: true }, { status: 200 });
      res.cookies.set("mureeh_session", "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0, secure: process.env.NODE_ENV === "production" });
      return res;
    } catch (error) {
      const { errorResponse, failureContext } = await import("@/lib/server/auth/request");
      return errorResponse(error, failureContext(req, "privacy-delete"));
    }
  });
}
