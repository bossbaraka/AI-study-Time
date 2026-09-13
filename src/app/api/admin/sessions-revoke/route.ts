import { NextResponse } from "next/server";
import { z } from "zod";
import { csrfRejected, errorResponse, forbiddenResponse, gateway, invalidRequestResponse, withAdmin } from "@/lib/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.object({ id: z.string().min(1) });

export async function POST(req: Request): Promise<NextResponse> {
  if (csrfRejected(req)) return forbiddenResponse();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();
  return withAdmin(req, async (admin) => {
    try {
      await gateway.revokeSessions(parsed.data.id, admin.id);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return await errorResponse(error);
    }
  });
}
