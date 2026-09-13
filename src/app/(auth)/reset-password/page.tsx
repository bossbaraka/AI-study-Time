"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { RedirectIfAuthenticated } from "@/features/auth/components/redirect-if-authenticated";

/** Reset password (route semantics: /auth/reset-password). Token arrives via emailed link. */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <RedirectIfAuthenticated>
        <ResetPasswordScreen />
      </RedirectIfAuthenticated>
    </Suspense>
  );
}

function ResetPasswordScreen() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  return <ResetPasswordForm token={token} />;
}
