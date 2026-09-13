import { NextResponse } from "next/server";
import { errorResponse, gateway, readSessionToken } from "@/lib/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/session — SessionState as data, never as an error. */
export async function GET(): Promise<NextResponse> {
  try {
    const state = await gateway.resolveSession(await readSessionToken());
    return NextResponse.json(state);
  } catch (error) {
    return await errorResponse(error);
  }
}
