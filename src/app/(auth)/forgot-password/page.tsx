"use client";

import { Suspense } from "react";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { RedirectIfAuthenticated } from "@/features/auth/components/redirect-if-authenticated";

/** Forgot password (route semantics: /auth/forgot-password). */
export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <RedirectIfAuthenticated>
        <ForgotPasswordForm />
      </RedirectIfAuthenticated>
    </Suspense>
  );
}
