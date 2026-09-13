"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { useI18n, useT } from "@/lib/i18n/provider";
import { useAdminSummary } from "@/features/admin/hooks/use-admin";

const STATS = [
  { key: "users" },
  { key: "suspended" },
  { key: "invitesPending" },
  { key: "sessionsActive" },
  { key: "auditToday" },
] as const;

const QUICK_LINKS = [
  { href: "/admin/invitations", key: "invitations" },
  { href: "/admin/users", key: "users" },
  { href: "/admin/audit", key: "audit" },
] as const;

/** Admin overview: the register at a glance — never a dashboard. */
export default function AdminOverviewPage() {
  const t = useT();
  const { direction } = useI18n();
  const Arrow = direction === "rtl" ? ArrowLeft : ArrowRight;
  const { data, isPending } = useAdminSummary();

  if (isPending) return <PageSkeleton />;

  return (
    <div className="flex flex-col gap-10">
      <section aria-labelledby="overview-title">
        <h1 id="overview-title" className="text-2xl font-semibold tracking-tight">
          {t("admin.overview.title")}
        </h1>
        <dl className="mt-6 grid grid-cols-2 divide-border rounded-lg border border-border bg-surface sm:grid-cols-5 sm:divide-x rtl:sm:divide-x-reverse">
          {STATS.map((stat, i) => (
            <div
              key={stat.key}
              className={
                i < STATS.length - 1
                  ? "border-b border-border p-4 last:border-b-0 sm:border-b-0"
                  : "p-4"
              }
            >
              <dt className="micro-label">{t(`admin.stats.${stat.key}`)}</dt>
              <dd className="tabular mt-1.5 text-2xl font-semibold">
                {data?.[stat.key] ?? 0}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="overview-quick">
        <h2 id="overview-quick" className="text-lg font-semibold tracking-tight">
          {t("admin.overview.quickTitle")}
        </h2>
        <ul className="mt-4 flex flex-col gap-2">
          {QUICK_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex items-center justify-between gap-4 rounded-md border border-border bg-surface px-4 py-3 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary focus-visible:shadow-focus focus-visible:outline-none"
              >
                {t(`admin.nav.${link.key}`)}
                <Arrow className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
