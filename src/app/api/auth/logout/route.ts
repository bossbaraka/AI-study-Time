import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  csrfRejected,
  errorResponse,
  forbiddenResponse,
  gateway,
  readSessionToken,
  requestMeta,
} from "@/lib/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/logout — revokes the session row and clears the cookie. */
export async function POST(req: Request): Promise<NextResponse> {
  if (csrfRejected(req)) return forbiddenResponse();
  try {
    await gateway.logout(await readSessionToken(), requestMeta(req));
    const res = new NextResponse(null, { status: 204 });
    return clearSessionCookie(res);
  } catch (error) {
    return await errorResponse(error);
  }
}
