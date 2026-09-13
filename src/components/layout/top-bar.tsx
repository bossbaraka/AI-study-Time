"use client";

import {
  Bell,
  Menu,
  Moon,
  Sun,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { siteConfig } from "@/config/site";
import { useT } from "@/lib/i18n/provider";
import { useStudent } from "@/features/journey/hooks/use-journey";
import { useNotifications } from "@/features/engagement/hooks/use-engagement";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/layout/wordmark";

/**
 * Top bar: brand (mobile), theme toggle, notifications, account.
 * Deliberately quiet — the journey state lives in the sidebar.
 */
export function TopBar({ onOpenMobileNav }: { onOpenMobileNav: () => void }) {
  const t = useT();
  const pathname = usePathname();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { data: student } = useStudent();
  const { data: notifications } = useNotifications();

  useEffect(() => setMounted(true), []);

  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;
  const isNotificationsPage = pathname === "/app/notifications";

  return (
    <header className="brand-edge sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-4 backdrop-blur-sm lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <Link href="/app" className="lg:hidden">
        <Wordmark compact />
      </Link>

      <div className="ms-auto flex items-center gap-1">
        {mounted && (
          <Tooltip content={resolvedTheme === "dark" ? "Light theme" : "Dark theme"}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {resolvedTheme === "dark" ? <Sun /> : <Moon />}
            </Button>
          </Tooltip>
        )}

        <Tooltip content={t("nav.notifications")}>
          <Link
            href="/app/notifications"
            aria-label={`${t("nav.notifications")}${unreadCount > 0 ? ` — ${unreadCount} unread` : ""}`}
            className={cn(
              "relative inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:shadow-focus focus-visible:outline-none",
              isNotificationsPage && "text-foreground",
            )}
          >
            <Bell className="size-4" aria-hidden="true" />
            {unreadCount > 0 && (
              <span className="absolute end-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
            )}
          </Link>
        </Tooltip>

        <Link
          href="/app/settings"
          className="ms-1 flex items-center gap-2.5 rounded-md p-1 pe-2 transition-colors hover:bg-muted focus-visible:shadow-focus focus-visible:outline-none"
        >
          <Avatar initials={student?.avatarInitials ?? "··"} size="sm" />
          <span className="hidden text-sm font-medium sm:block">
            {student?.fullName ?? siteConfig.shortName}
          </span>
        </Link>
      </div>
    </header>
  );
}
