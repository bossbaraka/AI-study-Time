/**
 * Auth service — the single entry point for all authentication operations.
 *
 * UI → hooks → THIS service → transport.
 * Components never call fetch, never see tokens, never import the mock.
 *
 * Transport resolution (see `AUTH_USE_GATEWAY`):
 * - Application runtime → the REAL server-side gateway (route handlers at
 *   /api/auth/*, httpOnly session cookie, Prisma+PostgreSQL persistence).
 * - Unit tests → the isolated mock backend, keeping component tests hermetic.
 */

import {
  AuthApiError,
  ApiError,
  AUTH_USE_GATEWAY,
  httpRequest,
  mockRequest,
} from "@/lib/api/client";
import { mockAuthBackend } from "@/services/auth/mock-auth-backend";
import { isAuthErrorCode } from "@/types/auth";
import type {
  AuthResponse,
  ForgotPasswordPayload,
  ForgotPasswordResponse,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  ResendVerificationPayload,
  ResendVerificationResponse,
  ResetPasswordPayload,
  ResetPasswordResponse,
  SessionState,
  VerifyEmailPayload,
  VerifyEmailResult,
} from "@/types/auth";

function toAuthError(error: unknown): AuthApiError {
  if (error instanceof AuthApiError) return error;
  if (error instanceof ApiError) {
    if (isAuthErrorCode(error.code)) {
      return new AuthApiError(error.code, error.status);
    }
    if (error.code === "network" || error.status === 0) {
      return new AuthApiError("network", error.status);
    }
    if (error.status === 401) return new AuthApiError("invalid_credentials", 401);
    if (error.status === 429) return new AuthApiError("rate_limited", 429);
    if (error.status === 410) return new AuthApiError("token_expired", 410);
    return new AuthApiError("unknown", error.status);
  }
  if (error instanceof TypeError) {
    return new AuthApiError("network", 0);
  }
  return new AuthApiError("unknown", 0);
}

export const authService = {
  login(payload: LoginPayload, signal?: AbortSignal): Promise<AuthResponse> {
    return AUTH_USE_GATEWAY
      ? httpRequest<AuthResponse>("/api/auth/login", {
          method: "POST",
          body: payload,
          signal,
        }).catch((e: unknown) => {
          throw toAuthError(e);
        })
      : mockRequest(() => mockAuthBackend.login(payload), signal);
  },

  register(payload: RegisterPayload, signal?: AbortSignal): Promise<RegisterResponse> {
    return AUTH_USE_GATEWAY
      ? httpRequest<RegisterResponse>("/api/auth/register", {
          method: "POST",
          body: payload,
          signal,
        }).catch((e: unknown) => {
          throw toAuthError(e);
        })
      : mockRequest(() => mockAuthBackend.register(payload), signal);
  },

  logout(signal?: AbortSignal): Promise<void> {
    return AUTH_USE_GATEWAY
      ? httpRequest<void>("/api/auth/logout", { method: "POST", signal }).catch(
          (e: unknown) => {
            throw toAuthError(e);
          },
        )
      : mockRequest(() => mockAuthBackend.logout(), signal);
  },

  /**
   * Resolve the current session. Never throws for the expected
   * unauthenticated/expired states — those are data, not errors.
   */
  getSessionState(signal?: AbortSignal): Promise<SessionState> {
    return AUTH_USE_GATEWAY
      ? httpRequest<SessionState>("/api/auth/session", { signal }).catch((e: unknown) => {
          const authError = toAuthError(e);
          if (authError.authCode === "session_expired" || authError.status === 401) {
            return {
              status: "unauthenticated",
              session: null,
              expired: authError.authCode === "session_expired",
            };
          }
          throw authError;
        })
      : mockRequest(() => mockAuthBackend.getSessionState(), signal);
  },

  forgotPassword(
    payload: ForgotPasswordPayload,
    signal?: AbortSignal,
  ): Promise<ForgotPasswordResponse> {
    return AUTH_USE_GATEWAY
      ? httpRequest<ForgotPasswordResponse>("/api/auth/forgot-password", {
          method: "POST",
          body: payload,
          signal,
        }).catch((e: unknown) => {
          throw toAuthError(e);
        })
      : mockRequest(() => mockAuthBackend.forgotPassword(payload.email), signal);
  },

  resetPassword(
    payload: ResetPasswordPayload,
    signal?: AbortSignal,
  ): Promise<ResetPasswordResponse> {
    return AUTH_USE_GATEWAY
      ? httpRequest<ResetPasswordResponse>("/api/auth/reset-password", {
          method: "POST",
          body: payload,
          signal,
        }).catch((e: unknown) => {
          throw toAuthError(e);
        })
      : mockRequest(() => mockAuthBackend.resetPassword(payload), signal);
  },

  verifyEmail(payload: VerifyEmailPayload, signal?: AbortSignal): Promise<VerifyEmailResult> {
    return AUTH_USE_GATEWAY
      ? httpRequest<VerifyEmailResult>("/api/auth/verify-email", {
          method: "POST",
          body: payload,
          signal,
        }).catch((e: unknown) => {
          throw toAuthError(e);
        })
      : mockRequest(() => mockAuthBackend.verifyEmail(payload), signal);
  },

  resendVerification(
    payload: ResendVerificationPayload,
    signal?: AbortSignal,
  ): Promise<ResendVerificationResponse> {
    return AUTH_USE_GATEWAY
      ? httpRequest<ResendVerificationResponse>("/api/auth/resend-verification", {
          method: "POST",
          body: payload,
          signal,
        }).catch((e: unknown) => {
          throw toAuthError(e);
        })
      : mockRequest(() => mockAuthBackend.resendVerification(payload.email), signal);
  },
};
