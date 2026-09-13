import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/schemas/auth";

/** Helper: collect the message keys of all issues for a field. */
function messagesFor(result: { error?: { issues: { path: (string | number)[]; message: string }[] } }, field: string): string[] {
  return (result.error?.issues ?? [])
    .filter((issue) => issue.path[0] === field)
    .map((issue) => issue.message);
}

describe("loginSchema", () => {
  it("rejects empty fields with required messages", () => {
    const result = loginSchema.safeParse({ email: "", password: "" });
    expect(result.success).toBe(false);
    expect(messagesFor(result, "email")).toContain("auth.errors.required");
    expect(messagesFor(result, "password")).toContain("auth.errors.required");
  });

  it("rejects an invalid email format", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "whatever1" });
    expect(result.success).toBe(false);
    expect(messagesFor(result, "email")).toContain("auth.errors.email");
  });

  it("accepts valid credentials shape without enforcing password policy at login", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "short" });
    expect(result.success).toBe(true);
  });

  it("trims email whitespace", () => {
    const result = loginSchema.safeParse({ email: "  user@example.com ", password: "x1" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("user@example.com");
  });
});

describe("registerSchema", () => {
  const valid = {
    name: "Layla Hassan",
    email: "layla@example.com",
    role: "student" as const,
    password: "securePass1",
    confirmPassword: "securePass1",
    inviteCode: "MU-ABCD-1234",
  };

  it("accepts a valid registration", () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it("requires an institutional invitation code", () => {
    const { inviteCode: _drop, ...withoutInvite } = valid;
    void _drop;
    const result = registerSchema.safeParse(withoutInvite);
    expect(result.success).toBe(false);
  });

  it("rejects a too-short name", () => {
    const result = registerSchema.safeParse({ ...valid, name: "L" });
    expect(result.success).toBe(false);
    expect(messagesFor(result, "name")).toContain("auth.errors.nameMin");
  });

  it("rejects a weak (too short) password", () => {
    const result = registerSchema.safeParse({ ...valid, password: "ab1", confirmPassword: "ab1" });
    expect(result.success).toBe(false);
    expect(messagesFor(result, "password")).toContain("auth.errors.passwordMin");
  });

  it("rejects a password without mixed character classes", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "onlyletters",
      confirmPassword: "onlyletters",
    });
    expect(result.success).toBe(false);
    expect(messagesFor(result, "password")).toContain("auth.errors.passwordComplexity");
  });

  it("rejects a common breached password even when it meets policy", () => {
    const result = registerSchema.safeParse({
      ...valid,
      password: "password123",
      confirmPassword: "password123",
    });
    expect(result.success).toBe(false);
    expect(messagesFor(result, "password")).toContain("auth.errors.passwordCommon");
  });

  it("rejects mismatched confirmation on the confirmPassword field", () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: "different1" });
    expect(result.success).toBe(false);
    expect(messagesFor(result, "confirmPassword")).toContain("auth.errors.passwordMatch");
  });

  it("rejects an unknown role", () => {
    const result = registerSchema.safeParse({ ...valid, role: "admin" });
    expect(result.success).toBe(false);
  });
});

describe("forgotPasswordSchema", () => {
  it("requires a valid email", () => {
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: "bad@" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: "user@example.com" }).success).toBe(true);
  });
});

describe("resetPasswordSchema", () => {
  it("requires a token and policy-compliant password", () => {
    const result = resetPasswordSchema.safeParse({
      token: "",
      password: "weak",
      confirmPassword: "weak",
    });
    expect(result.success).toBe(false);
    expect(messagesFor(result, "token")).toContain("auth.errors.tokenInvalid");
    expect(messagesFor(result, "password")).toContain("auth.errors.passwordMin");
  });

  it("accepts a valid reset payload", () => {
    const result = resetPasswordSchema.safeParse({
      token: "reset_123",
      password: "newSecure1",
      confirmPassword: "newSecure1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects mismatched confirmation", () => {
    const result = resetPasswordSchema.safeParse({
      token: "reset_123",
      password: "newSecure1",
      confirmPassword: "newSecure2",
    });
    expect(result.success).toBe(false);
    expect(messagesFor(result, "confirmPassword")).toContain("auth.errors.passwordMatch");
  });
});
