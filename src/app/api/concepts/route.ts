import { NextResponse } from "next/server";
import { withStudent } from "@/lib/server/auth/request";
import { getIntelligenceStores } from "@/services/infrastructure/intelligence-stores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/concepts
 * Returns the global concept catalog. No per-student filter, but
 * requires authentication so the catalog is not scraped anonymously.
 */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async () => {
    const stores = getIntelligenceStores();
    const concepts = await stores.concepts.list();
    return NextResponse.json(concepts);
  });
}
