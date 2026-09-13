import { NextResponse } from "next/server";
import {
  csrfRejected,
  errorResponse,
  forbiddenResponse,
  gateway,
  invalidRequestResponse,
} from "@/lib/server/auth/request";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Token from the recovery link; password policy enforced server-side too. */
const bodySchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).max(128),
});

export async function POST(req: Request): Promise<NextResponse> {
  if (csrfRejected(req)) return forbiddenResponse();
  const body: unknown = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return invalidRequestResponse();
  try {
    const result = await gateway.resetPassword(parsed.data.token, parsed.data.password);
    return NextResponse.json(result);
  } catch (error) {
    return await errorResponse(error);
  }
}
