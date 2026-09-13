"use client";

import {
  Bell,
  CheckCheck,
  Crosshair,
  Flame,
  LifeBuoy,
  MessageSquareText,
  Settings2,
  TimerOff,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import {
  useMarkAllNotificationsRead,
  useNotifications,
} from "@/features/engagement/hooks/use-engagement";
import { useT } from "@/lib/i18n/provider";
import { cn, formatDate } from "@/lib/utils";
import type { AppNotification, NotificationKind } from "@/types/domain";


const KIND_ICONS: Record<NotificationKind, typeof Bell> = {
  mission: Crosshair,
  recovery: LifeBuoy,
  delay: TimerOff,
  mastery: Flame,
  mentor: MessageSquareText,
  system: Settings2,
};

const KIND_TONES: Record<NotificationKind, "primary" | "info" | "warning" | "mastery" | "neutral"> = {
  mission: "primary",
  recovery: "info",
  delay: "warning",
  mastery: "mastery",
  mentor: "info",
  system: "neutral",
};

export default function NotificationsPage() {
  const t = useT();
  const notificationsQuery = useNotifications();
  const markAllRead = useMarkAllNotificationsRead();

  if (notificationsQuery.isLoading) return <PageSkeleton blocks={2} />;
  if (notificationsQuery.isError || !notificationsQuery.data) {
    return (
      <ErrorState
        title={t("state.error.title")}
        body={t("state.error.body")}
        onRetry={() => void notificationsQuery.refetch()}
      />
    );
  }

  const notifications = notificationsQuery.data;
  const hasUnread = notifications.some((n) => !n.read);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("notifications.title")}
        actions={
          hasUnread ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="size-4" aria-hidden="true" />
              {t("notifications.markAllRead")}
            </Button>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={t("notifications.empty.title")}
          body={t("notifications.empty.body")}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {notifications.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </ul>
      )}
    </div>
  );
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const t = useT();
  const Icon = KIND_ICONS[notification.kind];

  const content = (
    <div
      className={cn(
        "flex gap-4 rounded-lg border bg-surface p-5 transition-colors",
        notification.read ? "border-border" : "border-primary/30",
        notification.actionHref && "hover:border-border-strong",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border",
          !notification.read && "border-primary/30 bg-primary/10 text-primary",
          notification.read && "border-border bg-muted text-muted-foreground",
        )}
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={cn("text-sm", notification.read ? "font-medium" : "font-semibold")}>
            {notification.title}
          </h2>
          <Badge tone={KIND_TONES[notification.kind]}>{t(`notifications.kind.${notification.kind}`)}</Badge>
          {!notification.read && <span className="size-2 rounded-full bg-primary" aria-label="Unread" />}
        </div>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{notification.body}</p>
        <p className="tabular mt-2 text-2xs text-muted-foreground">
          {formatDate(notification.createdAt)}
        </p>
      </div>
      {notification.actionLabel && notification.actionHref && (
        <span className="hidden shrink-0 self-center text-xs font-medium text-primary sm:block">
          {notification.actionLabel}
        </span>
      )}
    </div>
  );

  return (
    <li>
      {notification.actionHref ? (
        <Link
          href={notification.actionHref}
          className="block focus-visible:shadow-focus focus-visible:outline-none rounded-lg"
        >
          {content}
        </Link>
      ) : (
        content
      )}
    </li>
  );
}
