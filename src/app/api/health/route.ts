import { NextResponse } from "next/server";

/**
 * GET /api/health — liveness.
 *
 * Reports the process, not the database: a health check that opens a
 * connection turns a database outage into a load-balancer eviction of healthy
 * app servers. Persistence has its own failure path (§28), which answers 503
 * on the request that actually needed it.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "mureeh-frontend",
    time: new Date().toISOString(),
  });
}
