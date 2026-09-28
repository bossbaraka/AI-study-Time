import { NextResponse } from "next/server";
import { z } from "zod";
import { csrfRejected, forbiddenResponse, invalidRequestResponse } from "@/lib/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const verifyEmailSchema = z.object({ token: z.string().trim().min(1).max(512) });

/**
 * Compatibility seam only: invitation registration pre-verifies accounts in
 * the current gateway, which has no token-verification operation. The token
 * shape is validated, but this route cannot validate its meaning; its static
 * response is therefore PARTIAL, not a claimed real verification flow.
 */
export async function POST(req: Request): Promise<NextResponse> {
  if (csrfRejected(req)) return forbiddenResponse();
  const parsed = verifyEmailSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();
  void parsed.data.token;
  return NextResponse.json({ status: "already-verified" });
}
