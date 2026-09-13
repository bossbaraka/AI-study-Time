"use client";

import { useState, type ReactNode } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Sidebar } from "@/components/navigation/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { MobileBottomNav } from "@/components/navigation/mobile-nav";
import { useT } from "@/lib/i18n/provider";

/**
 * Global application shell:
 * top bar + persistent sidebar (lg+) / drawer + bottom nav (mobile).
 * Main content is a semantic <main> with skip-link target.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const t = useT();

  return (
    <div className="min-h-dvh bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <div className="flex min-h-dvh">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 border-e border-border bg-background lg:block xl:w-72">
          <Sidebar />
        </aside>

        {/* Mobile navigation drawer */}
        <Sheet open={navOpen} onOpenChange={setNavOpen} title={t("product.shortName")}>
          <div className="h-[calc(100dvh-3.25rem)]">
            <Sidebar onNavigate={() => setNavOpen(false)} />
          </div>
        </Sheet>

        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar onOpenMobileNav={() => setNavOpen(true)} />
          <main
            id="main-content"
            tabIndex={-1}
            className="flex-1 px-4 pb-24 pt-6 lg:px-8 lg:pb-10"
          >
            <div className="mx-auto w-full max-w-5xl">{children}</div>
          </main>
          <MobileBottomNav />
        </div>
      </div>
    </div>
  );
}
