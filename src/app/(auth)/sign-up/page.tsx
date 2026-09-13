"use client";

import { Suspense } from "react";
import { RegisterForm } from "@/features/auth/components/register-form";
import { RedirectIfAuthenticated } from "@/features/auth/components/redirect-if-authenticated";

/** Register (route semantics: /auth/register). */
export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <RedirectIfAuthenticated>
        <RegisterForm />
      </RedirectIfAuthenticated>
    </Suspense>
  );
}
