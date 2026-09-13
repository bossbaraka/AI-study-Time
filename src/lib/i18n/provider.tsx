"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en, type Dictionary } from "./dictionaries/en";
import { ar } from "./dictionaries/ar";

export const SUPPORTED_LOCALES = ["en", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const RTL_LOCALES: ReadonlySet<string> = new Set<Locale>(["ar"]);

const DICTIONARIES: Record<Locale, Dictionary> = {
  en: en as unknown as Dictionary,
  ar,
};

const LOCALE_STORAGE_KEY = "mureeh.locale";

export interface I18nContextValue {
  locale: Locale;
  direction: "ltr" | "rtl";
  setLocale: (locale: Locale) => void;
  /** Translate a key with optional {param} interpolation. Falls back to English, then to the key. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (acc, [key, value]) => acc.replace(new RegExp(`\\{${key}\\}`, "g"), String(value)),
    template,
  );
}

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return SUPPORTED_LOCALES.includes(stored as Locale) ? (stored as Locale) : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  // Hydrate from storage after mount to avoid SSR/client mismatch.
  useEffect(() => {
    setLocaleState(getStoredLocale());
  }, []);

  const direction: "ltr" | "rtl" = RTL_LOCALES.has(locale) ? "rtl" : "ltr";

  // Keep <html dir/lang> in sync — RTL is a first-class concern.
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [locale, direction]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const dict = DICTIONARIES[locale];
      const raw = dict[key] ?? (en as unknown as Dictionary)[key] ?? key;
      return interpolate(raw, params);
    },
    [locale],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ locale, direction, setLocale, t }),
    [locale, direction, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

/** Convenience translation hook. */
export function useT() {
  return useI18n().t;
}
