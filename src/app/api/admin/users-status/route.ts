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

const body = z.object({
  id: z.string().trim().min(1).max(128),
  status: z.enum(["pending", "active", "suspended"]),
});

/** POST /api/admin/users-status — the official approve / suspend / restore switch. */
export async function POST(req: Request): Promise<NextResponse> {
  if (csrfRejected(req)) return forbiddenResponse();
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();

  return withAdmin(req, async (admin) => {
    await gateway.setUserStatus(parsed.data.id, parsed.data.status, admin.id);
    return NextResponse.json({ ok: true });
  });
}
