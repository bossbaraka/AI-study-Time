"use client";

import Link from "next/link";
import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useAdminOutbox } from "@/features/admin/hooks/use-admin";
import { useDateTimeFormatter } from "@/features/admin/lib/format";
import { useT } from "@/lib/i18n/provider";

/** Split a message body around http(s) links, rendering them as anchors. */
function MessageBody({ body }: { body: string }) {
  const parts = body.split(/(https?:\/\/[^\s]+)/g);
  return (
    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <Link
            key={i}
            href={part}
            className="break-all font-medium text-primary underline-offset-4 hover:underline focus-visible:shadow-focus focus-visible:outline-none rounded-xs"
            dir="ltr"
          >
            {part}
          </Link>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </p>
  );
}

/**
 * Outbox — the internal delivery channel standing in for the future
 * email gateway. Invitation and password-recovery links are written here
 * by the server; this view is what a mail transport would deliver.
 */
export default function AdminOutboxPage() {
  const t = useT();
  const format = useDateTimeFormatter();
  const { data, isPending } = useAdminOutbox();

  if (isPending) return <PageSkeleton />;

  return (
    <section aria-labelledby="outbox-title" className="flex flex-col gap-4">
      <h1 id="outbox-title" className="text-2xl font-semibold tracking-tight">
        {t("admin.outbox.title")}
      </h1>
      <p className="text-sm text-muted-foreground">{t("admin.outbox.note")}</p>

      {isPending ? (
        <PageSkeleton />
      ) : (data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("admin.outbox.empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {(data ?? []).map((message) => (
            <li
              key={message.id}
              className="rounded-lg border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">{message.subject}</p>
                <Badge tone={message.kind === "reset" ? "warning" : "info"}>
                  {t(`admin.outbox.kind.${message.kind}`)}
                </Badge>
                <p className="ms-auto text-xs text-muted-foreground" dir="ltr">
                  {message.to} · {format(message.createdAt)}
                </p>
              </div>
              <MessageBody body={message.body} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
