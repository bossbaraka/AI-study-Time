"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_NAV_ITEMS } from "@/constants/navigation";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Mobile bottom navigation — the five surfaces that answer
 * "what should I do now?" fit in a thumb's reach.
 * Safe-area aware; hidden from lg breakpoint up.
 */
export function MobileBottomNav() {
  const t = useT();
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm lg:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 text-2xs font-medium transition-colors focus-visible:shadow-focus focus-visible:outline-none",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span className="max-w-full truncate px-1">{t(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
