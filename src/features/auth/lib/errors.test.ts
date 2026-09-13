import { describe, expect, it } from "vitest";
import { ApiError, AuthApiError } from "@/lib/api/client";
import { isSessionExpired, normalizeAuthError } from "@/features/auth/lib/errors";

describe("normalizeAuthError", () => {
  it("maps every known auth code to a translation key", () => {
    const cases: [AuthApiError, string][] = [
      [new AuthApiError("invalid_credentials", 401), "auth.errors.invalidCredentials"],
      [new AuthApiError("email_already_registered", 409), "auth.errors.registerFailed"],
      [new AuthApiError("token_invalid", 400), "auth.errors.tokenInvalid"],
      [new AuthApiError("token_expired", 410), "auth.errors.tokenExpired"],
      [new AuthApiError("session_expired", 401), "auth.sessionExpired"],
      [new AuthApiError("rate_limited", 429), "auth.errors.rateLimited"],
      [new AuthApiError("network", 0), "auth.errors.network"],
      [new AuthApiError("unknown", 500), "auth.errors.generic"],
    ];
    for (const [error, messageKey] of cases) {
      expect(normalizeAuthError(error).messageKey).toBe(messageKey);
    }
  });

  it("maps generic ApiError statuses safely", () => {
    expect(normalizeAuthError(new ApiError("boom", 401)).code).toBe("invalid_credentials");
    expect(normalizeAuthError(new ApiError("boom", 429)).code).toBe("rate_limited");
    expect(normalizeAuthError(new ApiError("boom", 500)).code).toBe("unknown");
  });

  it("honors a known code from the real API error body", () => {
    const error = new ApiError("boom", 400, "token_expired");
    expect(normalizeAuthError(error).code).toBe("token_expired");
  });

  it("maps fetch-level TypeErrors to network", () => {
    const result = normalizeAuthError(new TypeError("Failed to fetch"));
    expect(result.code).toBe("network");
    expect(result.messageKey).toBe("auth.errors.network");
  });

  it("collapses unknown errors to the generic message", () => {
    const result = normalizeAuthError(new Error("internal SQL: SELECT * FROM users"));
    expect(result.code).toBe("unknown");
    expect(result.messageKey).toBe("auth.errors.generic");
  });

  it("never forwards raw backend messages", () => {
    const normalized = normalizeAuthError(new Error("postgres connection refused at 10.0.0.5"));
    expect(normalized.messageKey).not.toContain("postgres");
    expect(JSON.stringify(normalized)).not.toContain("10.0.0.5");
  });

  it("detects session expiry", () => {
    expect(isSessionExpired(new AuthApiError("session_expired", 401))).toBe(true);
    expect(isSessionExpired(new AuthApiError("invalid_credentials", 401))).toBe(false);
  });
});
