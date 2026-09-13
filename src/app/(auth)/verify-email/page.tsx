"use client";

import { Suspense } from "react";
import { EmailVerification } from "@/features/auth/components/email-verification";

/**
 * Email verification (route semantics: /auth/verify-email).
 * States: pending / verifying / success / failed / expired / already-verified.
 * Not wrapped in RedirectIfAuthenticated: an authenticated-but-unverified
 * user legitimately belongs on this screen.
 */
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <EmailVerification />
    </Suspense>
  );
}
