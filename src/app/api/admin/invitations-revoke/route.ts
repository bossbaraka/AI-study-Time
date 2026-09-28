import { NextResponse } from "next/server";
import { z } from "zod";
import {
  csrfRejected,
  forbiddenResponse,
  gateway,
  invalidRequestResponse,
  withAdmin,
} from "@/lib/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({ id: z.string().trim().min(1).max(128) });

export async function POST(req: Request): Promise<NextResponse> {
  if (csrfRejected(req)) return forbiddenResponse();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();

  // Let withAdmin own the single error funnel so failures keep its requestId,
  // operation, authenticated admin id and elapsed time.
  return withAdmin(req, async (admin) => {
    await gateway.revokeInvitation(parsed.data.id, admin.id);
    return NextResponse.json({ ok: true });
  });
}
