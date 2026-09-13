import { describe, expect, it } from "vitest";
import {
  homeRouteForRole,
  loginUrlWithNext,
  resolvePostAuthDestination,
  sanitizeNext,
} from "@/features/auth/lib/destination";
import type { Session } from "@/types/auth";

function makeSession(overrides: Partial<Session["user"]> = {}): Session {
  return {
    user: {
      id: "u1",
      name: "Test",
      email: "test@example.com",
      role: "student",
      emailVerification: "verified",
      onboarding: "completed",
      ...overrides,
    },
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  };
}

describe("sanitizeNext", () => {
  it("accepts internal relative paths", () => {
    expect(sanitizeNext("/app/roadmap")).toBe("/app/roadmap");
    expect(sanitizeNext("/app?tab=1")).toBe("/app?tab=1");
  });

  it("rejects protocol-relative and absolute URLs (open-redirect guard)", () => {
    expect(sanitizeNext("//evil.com")).toBeNull();
    expect(sanitizeNext("https://evil.com")).toBeNull();
    expect(sanitizeNext("http://evil.com/app")).toBeNull();
  });

  it("rejects backslash tricks and empty values", () => {
    expect(sanitizeNext("/\\evil.com")).toBeNull();
    expect(sanitizeNext("")).toBeNull();
    expect(sanitizeNext(null)).toBeNull();
    expect(sanitizeNext(undefined)).toBeNull();
  });
});

describe("resolvePostAuthDestination", () => {
  it("routes a verified, onboarded student home", () => {
    expect(resolvePostAuthDestination(makeSession())).toBe("/app");
  });

  it("routes a guardian to the guardian area", () => {
    expect(resolvePostAuthDestination(makeSession({ role: "guardian" }))).toBe("/guardian");
  });

  it("routes an unverified user to verification, preserving next", () => {
    const dest = resolvePostAuthDestination(
      makeSession({ emailVerification: "unverified" }),
      "/app/roadmap",
    );
    expect(dest).toBe("/verify-email?next=%2Fapp%2Froadmap");
  });

  it("routes a student with incomplete onboarding to the assessment entry", () => {
    expect(resolvePostAuthDestination(makeSession({ onboarding: "not-started" }))).toBe(
      "/assessment",
    );
    expect(
      resolvePostAuthDestination(makeSession({ onboarding: "in-progress" }), "/app/tests"),
    ).toBe("/assessment?next=%2Fapp%2Ftests");
  });

  it("honors a sanitized next destination over role home", () => {
    expect(resolvePostAuthDestination(makeSession(), "/app/recall")).toBe("/app/recall");
  });

  it("ignores a malicious next destination and falls back to role home", () => {
    expect(resolvePostAuthDestination(makeSession(), "//evil.com")).toBe("/app");
    expect(resolvePostAuthDestination(makeSession({ role: "guardian" }), "https://evil.com")).toBe(
      "/guardian",
    );
  });

  it("verification takes precedence over onboarding", () => {
    const dest = resolvePostAuthDestination(
      makeSession({ emailVerification: "pending", onboarding: "not-started" }),
    );
    expect(dest).toBe("/verify-email");
  });
});

describe("homeRouteForRole", () => {
  it("is role-aware", () => {
    expect(homeRouteForRole("student")).toBe("/app");
    expect(homeRouteForRole("guardian")).toBe("/guardian");
  });
});

describe("loginUrlWithNext", () => {
  it("preserves the intended destination", () => {
    expect(loginUrlWithNext("/app/roadmap")).toBe("/sign-in?next=%2Fapp%2Froadmap");
  });

  it("flags session expiry", () => {
    expect(loginUrlWithNext("/app", true)).toBe("/sign-in?next=%2Fapp&expired=1");
  });

  it("drops unsafe destinations", () => {
    expect(loginUrlWithNext("//evil.com")).toBe("/sign-in");
  });
});
