import { NextResponse } from "next/server";
import { gateway, withAdmin } from "@/lib/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  return withAdmin(req, async () => NextResponse.json(await gateway.summary()));
}
