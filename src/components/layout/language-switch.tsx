"use client";

import { useI18n, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/provider";

const LABELS: Record<Locale, string> = { en: "EN", ar: "ع" };

/** Minimal locale switch — RTL support is architectural, this is the entry point. */
export function LanguageSwitch() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex items-center rounded-md border border-border p-0.5" role="group" aria-label="Language">
      {SUPPORTED_LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={
            locale === code
              ? "rounded-sm bg-primary/15 px-2 py-1 text-2xs font-semibold text-primary"
              : "rounded-sm px-2 py-1 text-2xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          }
        >
          {LABELS[code]}
        </button>
      ))}
    </div>
  );
}
