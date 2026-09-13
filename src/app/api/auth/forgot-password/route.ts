import { NextResponse } from "next/server";
import { forgotPasswordSchema } from "@/schemas/auth";
import {
  csrfRejected,
  errorResponse,
  forbiddenResponse,
  gateway,
  invalidRequestResponse,
} from "@/lib/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<NextResponse> {
  if (csrfRejected(req)) return forbiddenResponse();
  const body: unknown = await req.json().catch(() => null);
  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) return invalidRequestResponse();
  try {
    const result = await gateway.forgotPassword(parsed.data.email);
    return NextResponse.json(result);
  } catch (error) {
    return await errorResponse(error);
  }
}
