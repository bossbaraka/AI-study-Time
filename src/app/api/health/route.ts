import { NextResponse } from "next/server";

/**
 * API seam placeholder.
 * When the REST/Supabase backend lands, feature routes are added here
 * (e.g. /api/me, /api/goal, /api/roadmap) and `USE_MOCK` in
 * src/lib/api/client.ts is flipped to false. Service signatures do not change.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "mureeh-frontend",
    mode: "mock",
    time: new Date().toISOString(),
  });
}
