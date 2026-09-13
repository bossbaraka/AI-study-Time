"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/layout/wordmark";
import { LanguageSwitch } from "@/components/layout/language-switch";
import { useLogout } from "@/features/auth/hooks/use-auth";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const ADMIN_TABS = [
  { href: "/admin", key: "overview" },
  { href: "/admin/users", key: "users" },
  { href: "/admin/invitations", key: "invitations" },
  { href: "/admin/audit", key: "audit" },
  { href: "/admin/outbox", key: "outbox" },
] as const;

/**
 * Administration portal shell: official header, semantic tab navigation,
 * and an explicit sign-out. The heavy lifting (who is admin) was already
 * verified server-side in the layout — this is structure, not security.
 */
export function AdminChrome({ children }: { children: ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();

  const onSignOut = () => {
    logout.mutate(undefined, {
      onSettled: () => router.replace("/sign-in"),
    });
  };

  return (
    <div className="brand-edge min-h-dvh bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
          <Link href="/admin" className="focus-visible:shadow-focus focus-visible:outline-none rounded-sm">
            <Wordmark />
          </Link>
          <p className="micro-label ms-auto sm:ms-0">{t("admin.portalLabel")}</p>
          <div className="flex items-center gap-1.5">
            <LanguageSwitch />
            <Button
              variant="ghost"
              size="sm"
              onClick={onSignOut}
              disabled={logout.isPending}
              aria-label={t("admin.signOut")}
            >
              <LogOut className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t("admin.signOut")}</span>
            </Button>
          </div>
          <nav
            aria-label={t("admin.portalLabel")}
            className="-mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto border-t border-border px-4 pt-3 sm:mx-0 sm:w-auto sm:border-0 sm:px-0 sm:pt-0"
          >
            {ADMIN_TABS.map((tab) => {
              const active =
                tab.href === "/admin" ? pathname === tab.href : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:shadow-focus focus-visible:outline-none",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {t(`admin.nav.${tab.key}`)}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
