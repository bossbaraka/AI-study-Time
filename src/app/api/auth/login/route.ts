import { NextResponse } from "next/server";
import { loginSchema } from "@/schemas/auth";
import {
  csrfRejected,
  errorResponse,
  failureContext,
  forbiddenResponse,
  gateway,
  invalidRequestResponse,
  requestMeta,
  setSessionCookie,
} from "@/lib/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/login — issues the httpOnly session cookie. */
export async function POST(req: Request): Promise<NextResponse> {
  const failure = failureContext(req, "auth");
  if (csrfRejected(req)) return forbiddenResponse();
  const body: unknown = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return invalidRequestResponse();

  try {
    const { token, session, maxAgeSec } = await gateway.login(parsed.data, requestMeta(req));
    return setSessionCookie(NextResponse.json({ session }), token, maxAgeSec);
  } catch (error) {
    return await errorResponse(error, failure);
  }
}
