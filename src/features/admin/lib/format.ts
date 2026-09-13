import { useCallback } from "react";
import { useI18n } from "@/lib/i18n/provider";

/** Locale-aware date/time formatting shared by the admin tables. */
export function useDateTimeFormatter() {
  const { locale } = useI18n();
  return useCallback(
    (iso: string): string => {
      const date = new Date(iso);
      if (Number.isNaN(date.getTime())) return iso;
      return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
    },
    [locale],
  );
}
