"use client";

import Link from "next/link";
import { Wordmark } from "@/components/layout/wordmark";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { useT } from "@/lib/i18n/provider";

/** Onboarding layout: minimal chrome, zero distractions, calm progress. */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="brand-edge flex h-14 items-center justify-between border-b border-border px-4 sm:px-6">
        <Link href="/" aria-label={t("product.name")}>
          <Wordmark />
        </Link>
        <LanguageSwitch />
      </header>
      <main id="main-content" className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-xl">{children}</div>
      </main>
    </div>
  );
}
