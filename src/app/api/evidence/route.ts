import { NextResponse } from "next/server";
import { invalidRequestResponse, withStudent } from "@/lib/server/auth/request";
import { getIntelligenceStores } from "@/services/infrastructure/intelligence-stores";
import type { CreateEvidenceInput } from "@/types/evidence";
import { EVIDENCE_KINDS } from "@/types/evidence";
import { createEvidenceService } from "@/services/evidence/evidence-service";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  kind: z.enum(EVIDENCE_KINDS as unknown as [string, ...string[]]),
  payload: z.record(z.unknown()),
  conceptId: z.string().min(1).max(100).nullable().optional(),
  score: z.number().min(0).max(1).nullable().optional(),
  timeSpentSeconds: z.number().int().min(0).max(86400).nullable().optional(),
  hintUsed: z.boolean().optional(),
  hintCount: z.number().int().min(0).max(100).optional(),
  learningUnitId: z.string().max(100).nullable().optional(),
  roadmapId: z.string().max(100).nullable().optional(),
});

/**
 * GET /api/evidence — student's evidence (bounded)
 * POST /api/evidence — create validated evidence (owned by caller)
 */
export async function GET(req: Request): Promise<NextResponse> {
  return withStudent(req, async (student) => {
    const url = new URL(req.url);
    const conceptId = url.searchParams.get("conceptId");
    const stores = getIntelligenceStores();
    if (conceptId) {
      const items = await stores.evidences.listByConcept(student.id, conceptId, 50);
      return NextResponse.json(items);
    }
    const items = await stores.evidences.listByStudent(student.id, 50);
    return NextResponse.json(items);
  });
}

export async function POST(req: Request): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();

  return withStudent(req, async (student) => {
    const stores = getIntelligenceStores();
    const svc = createEvidenceService(stores.evidences, stores.learningEvents, stores.conceptStates);
    const evidence = await svc.submit(student.id, parsed.data as CreateEvidenceInput);
    return NextResponse.json(evidence, { status: 201 });
  });
}
