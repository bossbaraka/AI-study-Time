import { NextResponse } from "next/server";
import { resendVerificationSchema } from "@/schemas/auth";
import {
  csrfRejected,
  errorResponse,
  failureContext,
  forbiddenResponse,
  gateway,
  invalidRequestResponse,
  requestMeta,
} from "@/lib/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/resend-verification — rate-limited and enumeration-resistant.
 * The gateway only issues a token for an existing, unverified account; every
 * address receives the same acknowledgement.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const failure = failureContext(req, "auth");
  if (csrfRejected(req)) return forbiddenResponse();
  const parsed = resendVerificationSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();

  try {
    const result = await gateway.resendVerification(parsed.data.email, requestMeta(req));
    return NextResponse.json(result);
  } catch (error) {
    return await errorResponse(error, failure);
  }
}
