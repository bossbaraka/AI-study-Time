"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { AUTH_ROUTES, NEXT_PARAM } from "@/features/auth/constants/auth.constants";
import { useRegister } from "@/features/auth/hooks/use-auth-actions";
import { AuthErrorMessage } from "@/features/auth/components/auth-error-message";
import { PasswordField } from "@/features/auth/components/password-field";
import { sanitizeNext } from "@/features/auth/lib/destination";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { registerSchema, resolveZodMessage, type RegisterValues } from "@/schemas/auth";

const ROLES = ["student", "guardian"] as const;

/**
 * Registration — minimal by design: name, email, role, password.
 * The detailed student profile belongs to STEP 3 onboarding, not here.
 * Success routes to verification; no auto sign-in.
 */
export function RegisterForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const registerMutation = useRegister();
  const [submitError, setSubmitError] = useState<unknown>(null);

  const nextParam = sanitizeNext(searchParams.get(NEXT_PARAM));

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: "student",
      email: "",
      name: "",
      inviteCode: "",
      password: "",
      confirmPassword: "",
    },
  });

  const selectedRole = watch("role");
  const password = watch("password") ?? "";
  const pending = isSubmitting || registerMutation.isPending;

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const { confirmPassword: _confirmPassword, ...payload } = values;
      void _confirmPassword; // Never forwarded to the service layer.
      const result = await registerMutation.mutateAsync(payload);
      const params = new URLSearchParams({ email: values.email });
      if (nextParam) params.set(NEXT_PARAM, nextParam);
      if (result.status === "active") {
        // Gateway mode: the invitation was the verification — sign-in ready.
        router.replace(`${AUTH_ROUTES.registerComplete}?${params.toString()}`);
        return;
      }
      router.replace(`${AUTH_ROUTES.verifyEmail}?${params.toString()}`);
    } catch (error) {
      setSubmitError(error);
    }
  });

  return (
    <div className="flex flex-col gap-7">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t("auth.signUp.title")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("auth.signUp.subtitle")}</p>
      </header>

      <AuthErrorMessage error={submitError} />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium text-foreground">{t("auth.role")}</legend>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t("auth.role")}>
            {ROLES.map((role) => {
              const selected = selectedRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setValue("role", role, { shouldValidate: true })}
                  className={cn(
                    "flex h-11 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:shadow-focus focus-visible:outline-none",
                    selected
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-input bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {selected && <Check className="size-3.5" aria-hidden="true" />}
                  {t(`auth.role.${role}`)}
                </button>
              );
            })}
          </div>
        </fieldset>

        <InputField
          label={t("auth.name")}
          autoComplete="name"
          aria-invalid={errors.name ? true : undefined}
          error={errors.name ? resolveZodMessage(errors.name.message ?? "", t) : null}
          className="h-11"
          {...register("name")}
        />
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
        <InputField
          label={t("auth.inviteCode")}
          hint={t("auth.inviteCode.hint")}
          autoComplete="one-time-code"
          spellCheck={false}
          aria-invalid={errors.inviteCode ? true : undefined}
          error={
            errors.inviteCode ? resolveZodMessage(errors.inviteCode.message ?? "", t) : null
          }
          className="h-11"
          {...register("inviteCode")}
        />
        <InputField
          label={t("auth.nationalId")}
          hint={t("auth.nationalId.hint")}
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={errors.nationalId ? true : undefined}
          error={
            errors.nationalId ? resolveZodMessage(errors.nationalId.message ?? "", t) : null
          }
          className="h-11"
          {...register("nationalId")}
        />
        <PasswordField
          label={t("auth.password")}
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
            errors.confirmPassword ? resolveZodMessage(errors.confirmPassword.message ?? "", t) : null
          }
          {...register("confirmPassword")}
        />

        {/* Live password-policy feedback: requirement list, not a strength game */}
        <PasswordRequirements password={password} />

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              <span aria-live="polite">{t("common.loading")}</span>
            </>
          ) : (
            t("auth.signUp")
          )}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {t("auth.haveAccount")}{" "}
        <Link
          href={AUTH_ROUTES.login}
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:shadow-focus focus-visible:outline-none rounded-xs"
        >
          {t("auth.signIn")}
        </Link>
      </p>
    </div>
  );
}

function PasswordRequirements({ password }: { password?: string }) {
  const t = useT();
  const val = password ?? "";
  if (val.length === 0) return null;

  const checks = [
    { met: val.length >= 8, label: t("auth.password.req.length") },
    { met: /[a-zA-Z]/.test(val), label: t("auth.password.req.letter") },
    { met: /[0-9]/.test(val), label: t("auth.password.req.number") },
  ];

  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label={t("auth.password.hint")}>
      {checks.map((check) => (
        <li
          key={check.label}
          className={cn(
            "flex items-center gap-1.5 text-xs",
            check.met ? "text-success-foreground" : "text-muted-foreground",
          )}
        >
          <Check
            className={cn("size-3", check.met ? "text-success" : "text-muted-foreground/50")}
            aria-hidden="true"
          />
          {check.label}
        </li>
      ))}
    </ul>
  );
}
