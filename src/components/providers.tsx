"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState, type ReactNode } from "react";
import { createQueryClient } from "@/lib/query-client";
import { I18nProvider } from "@/lib/i18n/provider";

/**
 * Global client providers.
 * Order matters: Theme + I18n are pure context; Query wraps data consumers.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      themes={["light", "dark"]}
      disableTransitionOnChange
    >
      <I18nProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
