import { describe, expect, it } from "vitest";
import { AuthApiError } from "@/lib/api/client";
import { authService } from "@/services/auth.service";

/**
 * Auth service contract tests, exercised against the mock backend.
 * The same suite must pass against the real API once USE_MOCK flips —
 * these assertions describe the contract, not the mock's internals.
 */

const VALID_PASSWORD = "securePass1";

describe("authService.login", () => {
  it("establishes a session with valid credentials", async () => {
    const { session } = await authService.login({
      email: "layla.hassan@example.com",
      password: VALID_PASSWORD,
    });
    expect(session.user.email).toBe("layla.hassan@example.com");
    expect(session.user.role).toBe("student");
    expect(session.user.emailVerification).toBe("verified");
    expect(new Date(session.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("never exposes tokens or password material on the session", async () => {
    const { session } = await authService.login({
      email: "layla.hassan@example.com",
      password: VALID_PASSWORD,
    });
    const serialized = JSON.stringify(session);
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain(VALID_PASSWORD);
  });

  it("rejects invalid credentials with invalid_credentials", async () => {
    await expect(
      authService.login({ email: "wrong@example.com", password: VALID_PASSWORD }),
    ).rejects.toMatchObject({ authCode: "invalid_credentials" });
  });

  it("rejects unknown accounts with the same generic error (no existence leak)", async () => {
    await expect(
      authService.login({ email: "nobody@example.com", password: VALID_PASSWORD }),
    ).rejects.toMatchObject({ authCode: "invalid_credentials" });
  });

  it("surfaces network failures as a network code", async () => {
    await expect(
      authService.login({ email: "offline@example.com", password: VALID_PASSWORD }),
    ).rejects.toMatchObject({ authCode: "network" });
  });

  it("rate-limits after repeated failures", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await authService
        .login({ email: "wrong@example.com", password: VALID_PASSWORD })
        .catch(() => undefined);
    }
    await expect(
      authService.login({ email: "wrong@example.com", password: VALID_PASSWORD }),
    ).rejects.toMatchObject({ authCode: "rate_limited" });
  });

  it("supports the guardian role", async () => {
    const { session } = await authService.login({
      email: "guardian@example.com",
      password: VALID_PASSWORD,
    });
    expect(session.user.role).toBe("guardian");
  });
});

describe("authService.register", () => {
  it("creates an unverified account and requires verification (no auto sign-in)", async () => {
    const result = await authService.register({
      name: "New Student",
      email: "new.student@example.com",
      password: VALID_PASSWORD,
      role: "student",
    });
    expect(result.status).toBe("verification-required");
    expect(result.email).toBe("new.student@example.com");

    // No session was established by registering.
    const state = await authService.getSessionState();
    expect(state.status).toBe("unauthenticated");
  });

  it("rejects a duplicate email", async () => {
    await expect(
      authService.register({
        name: "Duplicate",
        email: "layla.hassan@example.com",
        password: VALID_PASSWORD,
        role: "student",
      }),
    ).rejects.toMatchObject({ authCode: "email_already_registered" });
  });
});

describe("authService session lifecycle", () => {
  it("resolves unauthenticated when no session exists", async () => {
    const state = await authService.getSessionState();
    expect(state).toEqual({ status: "unauthenticated", session: null, expired: false });
  });

  it("resolves authenticated after login", async () => {
    await authService.login({ email: "layla.hassan@example.com", password: VALID_PASSWORD });
    const state = await authService.getSessionState();
    expect(state.status).toBe("authenticated");
    expect(state.session?.user.email).toBe("layla.hassan@example.com");
  });

  it("reports expiry distinctly from plain unauthenticated", async () => {
    await authService.login({ email: "expired@example.com", password: VALID_PASSWORD });
    const state = await authService.getSessionState();
    expect(state.status).toBe("unauthenticated");
    expect(state.expired).toBe(true);
  });

  it("logout ends the session", async () => {
    await authService.login({ email: "layla.hassan@example.com", password: VALID_PASSWORD });
    await authService.logout();
    const state = await authService.getSessionState();
    expect(state.status).toBe("unauthenticated");
    expect(state.expired).toBe(false);
  });
});

describe("authService.forgotPassword / resetPassword", () => {
  it("resolves generically for a known email", async () => {
    await expect(
      authService.forgotPassword({ email: "layla.hassan@example.com" }),
    ).resolves.toEqual({ status: "submitted" });
  });

  it("resolves identically for an unknown email (no existence leak)", async () => {
    await expect(
      authService.forgotPassword({ email: "ghost@example.com" }),
    ).resolves.toEqual({ status: "submitted" });
  });

  it("resets with a valid token", async () => {
    await expect(
      authService.resetPassword({ token: "demo-reset-token", password: "brandNew1" }),
    ).resolves.toEqual({ status: "reset" });
  });

  it("rejects an invalid token", async () => {
    await expect(
      authService.resetPassword({ token: "not-a-real-token", password: "brandNew1" }),
    ).rejects.toMatchObject({ authCode: "token_invalid" });
  });

  it("rejects an expired token distinctly", async () => {
    await expect(
      authService.resetPassword({ token: "expired-token", password: "brandNew1" }),
    ).rejects.toMatchObject({ authCode: "token_expired" });
  });

  it("invalidates active sessions after a password reset", async () => {
    await authService.login({ email: "layla.hassan@example.com", password: VALID_PASSWORD });
    await authService.resetPassword({ token: "demo-reset-token", password: "brandNew1" });
    const state = await authService.getSessionState();
    expect(state.status).toBe("unauthenticated");
  });
});

describe("authService.verifyEmail / resendVerification", () => {
  it("verifies a pending account with a valid token", async () => {
    await expect(
      authService.verifyEmail({ token: "demo-verify-token" }),
    ).resolves.toEqual({ status: "verified" });
  });

  it("rejects a consumed/unknown token", async () => {
    await authService.verifyEmail({ token: "demo-verify-token" });
    await expect(
      authService.verifyEmail({ token: "demo-verify-token" }),
    ).resolves.toEqual({ status: "invalid" });
  });

  it("reports an expired token distinctly", async () => {
    await expect(
      authService.verifyEmail({ token: "expired-token" }),
    ).resolves.toEqual({ status: "expired" });
  });

  it("resend resolves generically regardless of account existence", async () => {
    await expect(
      authService.resendVerification({ email: "pending@example.com" }),
    ).resolves.toEqual({ status: "sent" });
    await expect(
      authService.resendVerification({ email: "ghost@example.com" }),
    ).resolves.toEqual({ status: "sent" });
  });
});

describe("error typing", () => {
  it("throws AuthApiError instances carrying stable codes", async () => {
    const error = await authService
      .login({ email: "wrong@example.com", password: VALID_PASSWORD })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthApiError);
    expect((error as AuthApiError).authCode).toBe("invalid_credentials");
    // Raw messages must not contain sensitive internals.
    expect((error as AuthApiError).message).not.toContain("password");
  });
});
