import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Gateway mode pre-verifies every address through its institutional
 * invitation — the endpoint exists for contract parity with the client
 * service and always reports the verified state.
 */
export async function POST(): Promise<NextResponse> {
  return NextResponse.json({ status: "already-verified" });
}
