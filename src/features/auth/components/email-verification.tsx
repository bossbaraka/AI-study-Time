"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, MailCheck, TriangleAlert, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { AUTH_ROUTES, NEXT_PARAM } from "@/features/auth/constants/auth.constants";
import {
  useResendVerification,
  useVerifyEmail,
} from "@/features/auth/hooks/use-auth-actions";
import { useAuth } from "@/features/auth/hooks/use-auth";
import { resolvePostAuthDestination } from "@/features/auth/lib/destination";
import { useT } from "@/lib/i18n/provider";
import {
  resendVerificationSchema,
  resolveZodMessage,
  type ResendVerificationValues,
} from "@/schemas/auth";
import type { VerifyEmailResult } from "@/types/auth";

type VerificationView = "pending" | "verifying" | "verified" | "already-verified" | "invalid" | "expired";

/**
 * Email verification UX.
 * - With `?token=` (link from email): runs verification, renders
 *   success / failed / expired states.
 * - Without token: pending state + resend form (pre-filled with ?email=).
 * - Already-verified session: notice + continue.
 * The frontend only consumes the verification endpoint contract;
 * no fake verification logic lives here.
 */
export function EmailVerification() {
  const t = useT();
  const searchParams = useSearchParams();
  const { user, isLoading: sessionLoading } = useAuth();
  const verifyEmail = useVerifyEmail();
  const resend = useResendVerification();

  const token = searchParams.get("token");
  const emailParam = searchParams.get("email") ?? "";
  const nextParam = searchParams.get(NEXT_PARAM);

  const [view, setView] = useState<VerificationView>(token ? "verifying" : "pending");
  const [resendSent, setResendSent] = useState(false);

  // Run verification once when arriving with a token.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    const run = async (): Promise<void> => {
      try {
        const result: VerifyEmailResult = await verifyEmail.mutateAsync({ token });
        if (!cancelled) setView(result.status);
      } catch {
        if (!cancelled) setView("invalid");
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // Runs once per token — mutation state changes must not re-trigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResendVerificationValues>({
    resolver: zodResolver(resendVerificationSchema),
    defaultValues: { email: emailParam },
  });

  // Already-verified session arriving without a token.
  useEffect(() => {
    if (!sessionLoading && !token && user?.emailVerification === "verified") {
      setView("already-verified");
    }
  }, [sessionLoading, token, user?.emailVerification]);

  const onResend = handleSubmit(async (values) => {
    try {
      await resend.mutateAsync(values);
      setResendSent(true);
    } catch {
      // Generic failure: resend is best-effort, keep the pending state.
      setResendSent(false);
    }
  });

  const continueHref = user
    ? resolvePostAuthDestination({ user, issuedAt: "", expiresAt: "" }, nextParam)
    : AUTH_ROUTES.login;

  return (
    <div className="flex flex-col gap-7">
      {view === "verifying" && (
        <div role="status" className="flex flex-col items-center gap-4 py-10 text-center">
          <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">{t("auth.verify.verifying")}</p>
        </div>
      )}

      {view === "verified" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-5 py-8 text-center"
        >
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 16 }}
            className="flex size-14 items-center justify-center rounded-full border border-success/40 bg-success-subtle text-success"
          >
            <CheckCircle2 className="size-7" aria-hidden="true" />
          </motion.span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t("auth.verify.success.title")}</h1>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t("auth.verify.success.body")}
            </p>
          </div>
          <Link href={continueHref}>
            <Button size="lg">{t("auth.verify.success.cta")}</Button>
          </Link>
        </motion.div>
      )}

      {view === "already-verified" && (
        <div className="flex flex-col gap-6" role="status">
          <header className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full border border-success/40 bg-success-subtle text-success">
              <MailCheck className="size-5" aria-hidden="true" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">{t("auth.verify.already.title")}</h1>
          </header>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("auth.verify.already.body")}
          </p>
          <div>
            <Link href={continueHref}>
              <Button size="lg">{t("auth.verify.success.cta")}</Button>
            </Link>
          </div>
        </div>
      )}

      {(view === "invalid" || view === "expired") && (
        <div className="flex flex-col gap-6">
          <header className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full border border-danger/35 bg-danger-subtle text-danger">
              {view === "expired" ? (
                <TriangleAlert className="size-5" aria-hidden="true" />
              ) : (
                <XCircle className="size-5" aria-hidden="true" />
              )}
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">
              {view === "expired" ? t("auth.verify.expired.title") : t("auth.verify.failed.title")}
            </h1>
          </header>
          <p role="alert" className="text-sm leading-relaxed text-muted-foreground">
            {view === "expired" ? t("auth.verify.expired.body") : t("auth.verify.failed.body")}
          </p>

          {/* Recovery path: resend the verification email */}
          <form onSubmit={onResend} noValidate className="flex flex-col gap-4">
            <InputField
              label={t("auth.verify.emailLabel")}
              type="email"
              inputMode="email"
              autoComplete="email"
              defaultValue={emailParam}
              aria-invalid={errors.email ? true : undefined}
              error={errors.email ? resolveZodMessage(errors.email.message ?? "", t) : null}
              className="h-11"
              {...register("email")}
            />
            <Button type="submit" size="lg" variant="secondary" disabled={isSubmitting || resend.isPending}>
              {isSubmitting || resend.isPending ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <MailCheck className="size-4" aria-hidden="true" />
              )}
              {t("auth.verify.resend")}
            </Button>
            {resendSent && (
              <p role="status" className="text-sm font-medium text-success-foreground">
                {t("auth.verify.resend.sent")}
              </p>
            )}
          </form>
        </div>
      )}

      {view === "pending" && (
        <div className="flex flex-col gap-6">
          <header className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
              <MailCheck className="size-5" aria-hidden="true" />
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">{t("auth.verify.pending.title")}</h1>
          </header>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {emailParam
              ? t("auth.verify.pending.body", { email: emailParam })
              : t("auth.verify.pending.bodyNoEmail")}
          </p>

          <form onSubmit={onResend} noValidate className="flex flex-col gap-4">
            <InputField
              label={t("auth.verify.emailLabel")}
              type="email"
              inputMode="email"
              autoComplete="email"
              defaultValue={emailParam}
              aria-invalid={errors.email ? true : undefined}
              error={errors.email ? resolveZodMessage(errors.email.message ?? "", t) : null}
              className="h-11"
              {...register("email")}
            />
            <Button type="submit" size="lg" variant="secondary" disabled={isSubmitting || resend.isPending}>
              {isSubmitting || resend.isPending ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <MailCheck className="size-4" aria-hidden="true" />
              )}
              {t("auth.verify.resend")}
            </Button>
            {resendSent && (
              <p role="status" className="text-sm font-medium text-success-foreground">
                {t("auth.verify.resend.sent")}
              </p>
            )}
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
      )}
    </div>
  );
}
