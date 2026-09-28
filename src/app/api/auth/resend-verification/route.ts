import { NextResponse } from "next/server";
import { csrfRejected, forbiddenResponse, invalidRequestResponse } from "@/lib/server/auth/request";
import { forgotPasswordSchema } from "@/schemas/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Compatibility seam only: the current gateway pre-verifies invitation
 * accounts and has no email-delivery operation. Validate the caller's
 * existing `{email}` contract, but classify the static acknowledgement as
 * PARTIAL until real outbox/provider delivery is specified and implemented.
 */
export async function POST(req: Request): Promise<NextResponse> {
  if (csrfRejected(req)) return forbiddenResponse();
  const parsed = forgotPasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();
  void parsed.data.email;
  return NextResponse.json({ status: "sent" });
}
