import { NextResponse } from "next/server";
import { registerApiSchema } from "@/schemas/auth";
import {
  csrfRejected,
  errorResponse,
  forbiddenResponse,
  gateway,
  invalidRequestResponse,
  requestMeta,
} from "@/lib/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/register — invitation-gated official registration. */
export async function POST(req: Request): Promise<NextResponse> {
  if (csrfRejected(req)) return forbiddenResponse();
  const body: unknown = await req.json().catch(() => null);
  const parsed = registerApiSchema.safeParse(body);
  if (!parsed.success) return invalidRequestResponse();

  try {
    const result = await gateway.register(
      {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        inviteCode: parsed.data.inviteCode,
        nationalId: parsed.data.nationalId || undefined,
      },
      requestMeta(req),
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return await errorResponse(error);
  }
}
