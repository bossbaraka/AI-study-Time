import { NextResponse } from "next/server";
import { withStudent } from "@/lib/server/auth/request";
import { executionApplication } from "@/services/application/execution-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/executions/view
 *
 * The runtime execution view over the student's ACTIVE roadmap — derived unit
 * statuses, current unit, honest completion flag. `null` when the student has
 * no roadmap yet; the roadmap flow owns that case.
 *
 * Every status here is DERIVED from persisted executions, never accepted from
 * a client. A unit the student has not started reads `available` because the
 * dependency graph says so, not because the client said so.
 */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async (student) =>
    NextResponse.json(await executionApplication.getExecutionView(student.id)),
  );
}
