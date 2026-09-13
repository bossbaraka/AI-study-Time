"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { AUTH_ROUTES } from "@/features/auth/constants/auth.constants";
import { useForgotPassword } from "@/features/auth/hooks/use-auth-actions";
import { AuthErrorMessage } from "@/features/auth/components/auth-error-message";
import { useT } from "@/lib/i18n/provider";
import {
  forgotPasswordSchema,
  resolveZodMessage,
  type ForgotPasswordValues,
} from "@/schemas/auth";

/**
 * Forgot password — the response is deliberately generic.
 * Whether or not the email exists, the user sees the same confirmation:
 * account existence must never be discoverable from this screen.
 */
export function ForgotPasswordForm() {
  const t = useT();
  const forgotPassword = useForgotPassword();
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({ resolver: zodResolver(forgotPasswordSchema) });

  const pending = isSubmitting || forgotPassword.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await forgotPassword.mutateAsync(values);
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error);
    }
  });

  if (submitted) {
    return (
      <div className="flex flex-col gap-7">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">{t("auth.forgot.title")}</h1>
        </header>
        <div
          role="status"
          className="flex flex-col items-start gap-3 rounded-lg border border-success/30 bg-success-subtle p-4"
        >
          <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
          <p className="text-sm leading-relaxed text-success-foreground">{t("auth.forgot.sent")}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          <Link
            href={AUTH_ROUTES.login}
            className="font-medium text-primary underline-offset-4 hover:underline focus-visible:shadow-focus focus-visible:outline-none rounded-xs"
          >
            {t("common.back")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.forgot.title")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("auth.forgot.subtitle")}</p>
      </header>

      <AuthErrorMessage error={submitError} />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <InputField
          label={t("auth.email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          error={errors.email ? resolveZodMessage(errors.email.message ?? "", t) : null}
          className="h-11"
          {...register("email")}
        />
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              <span aria-live="polite">{t("common.loading")}</span>
            </>
          ) : (
            t("auth.forgot.send")
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
    </div>
  );
}
