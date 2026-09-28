/**
 * Public auth route integration — real handlers, real Prisma gateway.
 *
 * These routes intentionally do not share the student/admin wrapper. The
 * handler-level boundary is still exercised: JSON parsing, Zod validation,
 * CSRF check, gateway operations and the stable error response.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as resendVerification } from "@/app/api/auth/resend-verification/route";
import { GET as getSession } from "@/app/api/auth/session/route";
import { POST as verifyEmail } from "@/app/api/auth/verify-email/route";
import { __clearRateBuckets } from "@/lib/server/auth/rate-limit";
import { ORIGIN } from "@/test/route-harness";

function request(body?: unknown, method = "POST") {
  return new Request(`${ORIGIN}/api/auth/test`, {
    method,
    headers: { ...(method === "POST" ? { "content-type": "application/json", origin: ORIGIN } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  __clearRateBuckets();
});

describe("auth routes — validation and stable gateway contracts", () => {
  it("rejects malformed login input before password work", async () => {
    const res = await login(request({ email: "not-an-email", password: "x" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "unknown" });
  });

  it("uses the real gateway for a syntactically valid login and does not enumerate", async () => {
    const res = await login(request({ email: "missing-auth-route@example.test", password: "securePass1" }));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ code: "invalid_credentials" });
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("returns the same generic forgot-password response for an unknown email", async () => {
    const res = await forgotPassword(request({ email: "unknown-auth-route@example.test" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "submitted" });
  });

  it("validates password-reset payloads at the HTTP boundary", async () => {
    const res = await resetPassword(request({ token: "short", password: "bad" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ code: "unknown" });
  });

  it("validates registration before touching invitation persistence", async () => {
    const res = await register(request({ email: "bad" }));
    expect(res.status).toBe(400);
  });

  it("validates resend/verify inputs and never confirms an unknown token", async () => {
    expect((await resendVerification(request({}))).status).toBe(400);
    expect((await verifyEmail(request({ token: "" }))).status).toBe(400);

    const resend = await resendVerification(request({ email: "valid@example.test" }));
    expect(resend.status).toBe(200);
    expect(await resend.json()).toEqual({ status: "sent" });

    const verify = await verifyEmail(request({ token: "unknown-token" }));
    expect(verify.status).toBe(200);
    expect(await verify.json()).toEqual({ status: "invalid" });
  });

  it("session is data for an anonymous caller; logout is idempotent without a cookie", async () => {
    const state = await getSession(request(undefined, "GET"));
    expect(state.status).toBe(200);
    expect((await state.json()).status).toBe("unauthenticated");

    const out = await logout(request());
    expect(out.status).toBe(204);
  });
});
