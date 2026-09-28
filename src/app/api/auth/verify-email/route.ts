import { NextResponse } from "next/server";
import { z } from "zod";
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

const verifyEmailSchema = z.object({ token: z.string().trim().min(1).max(512) });

/** POST /api/auth/verify-email — consume a single-use server-issued token. */
export async function POST(req: Request): Promise<NextResponse> {
  const failure = failureContext(req, "auth");
  if (csrfRejected(req)) return forbiddenResponse();
  const parsed = verifyEmailSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();

  try {
    const result = await gateway.verifyEmail(parsed.data.token, requestMeta(req));
    return NextResponse.json(result);
  } catch (error) {
    return await errorResponse(error, failure);
  }
}
