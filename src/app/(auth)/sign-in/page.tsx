"use client";

import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/login-form";
import { RedirectIfAuthenticated } from "@/features/auth/components/redirect-if-authenticated";

/** Login (route semantics: /auth/login — existing flat convention preserved). */
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <RedirectIfAuthenticated>
        <LoginForm />
      </RedirectIfAuthenticated>
    </Suspense>
  );
}
