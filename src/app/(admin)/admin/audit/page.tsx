"use client";

import { PageSkeleton } from "@/components/ui/skeleton";
import { useAdminAudit } from "@/features/admin/hooks/use-admin";
import { useDateTimeFormatter } from "@/features/admin/lib/format";
import { useT } from "@/lib/i18n/provider";

/**
 * Audit register — append-only trail of every security-relevant action.
 * Read-only by design: administrators observe, never edit history.
 */
export default function AdminAuditPage() {
  const t = useT();
  const format = useDateTimeFormatter();
  const { data, isPending } = useAdminAudit();

  if (isPending) return <PageSkeleton />;

  return (
    <section aria-labelledby="audit-title" className="flex flex-col gap-4">
      <h1 id="audit-title" className="text-2xl font-semibold tracking-tight">
        {t("admin.audit.title")}
      </h1>
      <p className="text-sm text-muted-foreground">{t("admin.audit.note")}</p>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t("admin.audit.caption")}</caption>
          <thead>
            <tr className="border-b border-border">
              {[
                t("admin.audit.col.when"),
                t("admin.audit.col.event"),
                t("admin.audit.col.actor"),
                t("admin.audit.col.subject"),
                t("admin.audit.col.ip"),
              ].map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="px-3 py-2.5 text-start text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((event) => (
              <tr key={event.id} className="border-b border-border/60 last:border-b-0 align-middle">
                <th scope="row" className="px-3 py-2.5 text-start font-normal whitespace-nowrap text-muted-foreground">
                  {format(event.createdAt)}
                </th>
                <td className="px-3 py-2.5">
                  <span className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-2xs font-medium">
                    {t(`admin.audit.type.${event.type}`)}
                  </span>
                </td>
                <td className="px-3 py-2.5">{event.actorName ?? "—"}</td>
                <td className="px-3 py-2.5">{event.subjectName ?? "—"}</td>
                <td className="px-3 py-2.5 text-muted-foreground" dir="ltr">
                  {event.ip ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
