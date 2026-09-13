"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { AUTH_ROUTES, NEXT_PARAM } from "@/features/auth/constants/auth.constants";
import { useLogin } from "@/features/auth/hooks/use-auth-actions";
import { resolvePostAuthDestination } from "@/features/auth/lib/destination";
import { AuthErrorMessage } from "@/features/auth/components/auth-error-message";
import { PasswordField } from "@/features/auth/components/password-field";
import { useT } from "@/lib/i18n/provider";
import { loginSchema, resolveZodMessage, type LoginValues } from "@/schemas/auth";

/**
 * Login form. All auth logic lives in hooks/services — this component
 * is presentation + form state only. Post-login destination is resolved
 * from session state (verification, onboarding, role), never hardcoded.
 */
export function LoginForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const nextParam = searchParams.get(NEXT_PARAM);
  const sessionExpired = searchParams.get("expired") === "1";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const pending = isSubmitting || login.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const { session } = await login.mutateAsync(values);
      router.replace(resolvePostAuthDestination(session, nextParam));
    } catch (error) {
      setSubmitError(error);
    }
  });

  return (
    <div className="flex flex-col gap-7">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.signIn.title")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("auth.signIn.subtitle")}</p>
      </header>

      {/* Session-expired notice: calm, explains why we're back here */}
      {sessionExpired && (
        <p
          role="status"
          className="rounded-md border border-warning/30 bg-warning-subtle px-3.5 py-3 text-sm leading-relaxed text-warning-foreground"
        >
          {t("auth.sessionExpired")}
        </p>
      )}

      <AuthErrorMessage error={submitError} />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <InputField
          label={t("auth.email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={errors.email ? true : undefined}
          error={errors.email ? resolveZodMessage(errors.email.message ?? "", t) : null}
          className="h-11"
          {...register("email")}
        />
        <PasswordField
          label={t("auth.password")}
          autoComplete="current-password"
          error={errors.password ? resolveZodMessage(errors.password.message ?? "", t) : null}
          {...register("password")}
        />
        <div className="flex justify-end">
          <Link
            href={AUTH_ROUTES.forgotPassword}
            className="text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:shadow-focus focus-visible:outline-none rounded-xs"
          >
            {t("auth.forgot")}
          </Link>
        </div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              <span aria-live="polite">{t("common.loading")}</span>
            </>
          ) : (
            t("auth.signIn")
          )}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link
          href={AUTH_ROUTES.register}
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:shadow-focus focus-visible:outline-none rounded-xs"
        >
          {t("auth.signUp")}
        </Link>
      </p>
    </div>
  );
}
