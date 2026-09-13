"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { AUTH_ROUTES } from "@/features/auth/constants/auth.constants";
import { useResetPassword } from "@/features/auth/hooks/use-auth-actions";
import { AuthErrorMessage } from "@/features/auth/components/auth-error-message";
import { PasswordField } from "@/features/auth/components/password-field";
import { normalizeAuthError } from "@/features/auth/lib/errors";
import { useT } from "@/lib/i18n/provider";
import {
  resetPasswordSchema,
  resolveZodMessage,
  type ResetPasswordValues,
} from "@/schemas/auth";

/**
 * Reset password — consumes the token from the emailed link.
 * Invalid/expired tokens are surfaced as distinct, recoverable states
 * with a path back to requesting a new link.
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useT();
  const resetPassword = useResetPassword();
  const [resetDone, setResetDone] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token },
  });

  const pending = isSubmitting || resetPassword.isPending;
  const normalized = submitError ? normalizeAuthError(submitError) : null;
  const tokenRejected =
    normalized?.code === "token_invalid" || normalized?.code === "token_expired";

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const { confirmPassword: _confirmPassword, ...payload } = values;
      void _confirmPassword; // Never forwarded to the service layer.
      await resetPassword.mutateAsync(payload);
      setResetDone(true);
    } catch (error) {
      setSubmitError(error);
    }
  });

  if (resetDone) {
    return (
      <div className="flex flex-col gap-7">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{t("auth.reset.success.title")}</h1>
        </header>
        <div
          role="status"
          className="flex flex-col items-start gap-3 rounded-lg border border-success/30 bg-success-subtle p-4"
        >
          <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-success-foreground">
            {t("auth.reset.success.body")}
          </p>
        </div>
        <Link href={AUTH_ROUTES.login}>
          <Button size="lg">{t("auth.signIn")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.reset.title")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("auth.reset.subtitle")}</p>
      </header>

      {/* Token problems get a dedicated path back to requesting a new link */}
      {tokenRejected ? (
        <div className="flex flex-col gap-4">
          <AuthErrorMessage error={submitError} />
          <Link href={AUTH_ROUTES.forgotPassword}>
            <Button variant="secondary" size="lg">
              {t("auth.forgot.send")}
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground">
            <Link
              href={AUTH_ROUTES.login}
              className="font-medium text-primary underline-offset-4 hover:underline focus-visible:shadow-focus focus-visible:outline-none rounded-xs"
            >
              {t("common.back")}
            </Link>
          </p>
        </div>
      ) : (
        <>
          <AuthErrorMessage error={submitError} />

          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <input type="hidden" {...register("token")} />
            <PasswordField
              label={t("auth.reset.newPassword")}
              autoComplete="new-password"
              hint={t("auth.password.hint")}
              aria-invalid={errors.password ? true : undefined}
              error={errors.password ? resolveZodMessage(errors.password.message ?? "", t) : null}
              {...register("password")}
            />
            <PasswordField
              label={t("auth.confirmPassword")}
              autoComplete="new-password"
              aria-invalid={errors.confirmPassword ? true : undefined}
              error={
                errors.confirmPassword
                  ? resolveZodMessage(errors.confirmPassword.message ?? "", t)
                  : null
              }
              {...register("confirmPassword")}
            />
            <Button type="submit" size="lg" disabled={pending || token.length === 0}>
              {pending ? (
                <>
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  <span aria-live="polite">{t("common.loading")}</span>
                </>
              ) : (
                t("auth.reset.submit")
              )}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground">
            <Link
              href={AUTH_ROUTES.login}
              className="font-medium text-primary underline-offset-4 hover:underline focus-visible:shadow-focus focus-visible:outline-none rounded-xs"
            >
              {t("common.back")}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
