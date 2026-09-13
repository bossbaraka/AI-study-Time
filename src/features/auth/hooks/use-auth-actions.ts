"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { authService } from "@/services/auth.service";
import type {
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  ResendVerificationPayload,
  ResetPasswordPayload,
  VerifyEmailPayload,
} from "@/types/auth";

/**
 * Auth mutations. Each keeps session cache coherent:
 * login seeds it, verification invalidates it (email state changed).
 */

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: LoginPayload) => authService.login(payload),
    onSuccess: ({ session }) => {
      queryClient.setQueryData(queryKeys.session, {
        status: "authenticated",
        session,
        expired: false,
      });
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (payload: ForgotPasswordPayload) => authService.forgotPassword(payload),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (payload: ResetPasswordPayload) => authService.resetPassword(payload),
  });
}

export function useVerifyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: VerifyEmailPayload) => authService.verifyEmail(payload),
    onSuccess: (result) => {
      if (result.status === "verified" || result.status === "already-verified") {
        void queryClient.invalidateQueries({ queryKey: queryKeys.session });
      }
    },
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: (payload: ResendVerificationPayload) => authService.resendVerification(payload),
  });
}
