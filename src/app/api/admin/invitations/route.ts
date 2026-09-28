import { NextResponse } from "next/server";
import { z } from "zod";
import { gateway, invalidRequestResponse, withAdmin } from "@/lib/server/auth/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  return withAdmin(req, async () => NextResponse.json(await gateway.listInvitations()));
}

const create = z.object({
  email: z.string().trim().email().max(254),
  role: z.enum(["student", "guardian"]),
  // The admin form submits an empty string when this optional field is blank.
  // Accept that existing contract as well as omission; do not reject it at the
  // transport boundary before the gateway can normalise it to null.
  nationalId: z.string().trim().regex(/^\d{8,14}$/).or(z.literal("")).optional(),
  note: z.string().trim().max(200).optional(),
  expiresInDays: z.number().int().min(1).max(90).optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const parsed = create.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();
  return withAdmin(req, async (admin) =>
    NextResponse.json(await gateway.createInvitation(admin.id, parsed.data), { status: 201 }),
  );
}
