import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ status: "sent" });
}
