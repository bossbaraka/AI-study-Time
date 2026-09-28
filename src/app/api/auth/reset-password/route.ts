import { NextResponse } from "next/server";
import {
  csrfRejected,
  errorResponse,
  failureContext,
  forbiddenResponse,
  gateway,
  invalidRequestResponse,
  requestMeta,
} from "@/lib/server/auth/request";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Token from the recovery link; password policy enforced server-side too. */
const bodySchema = z.object({
  token: z.string().min(10).max(512),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request): Promise<NextResponse> {
  const failure = failureContext(req, "auth");
  if (csrfRejected(req)) return forbiddenResponse();
  const body: unknown = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return invalidRequestResponse();
  try {
    const result = await gateway.resetPassword(parsed.data.token, parsed.data.password, requestMeta(req));
    return NextResponse.json(result);
  } catch (error) {
    return await errorResponse(error, failure);
  }
}
