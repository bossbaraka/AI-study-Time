"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, ShieldCheck } from "lucide-react";
import { NAV_SECTIONS } from "@/constants/navigation";
import { useT } from "@/lib/i18n/provider";
import { useGoal, useRoadmap, useStudent } from "@/features/journey/hooks/use-journey";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Tooltip } from "@/components/ui/tooltip";
import { Wordmark } from "@/components/layout/wordmark";

/**
 * Application sidebar.
 * Beyond navigation it always answers: where am I in the journey,
 * and are my goal/roadmap protected?
 */
export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const t = useT();
  const pathname = usePathname();
  const { data: student } = useStudent();
  const { data: goal } = useGoal();
  const { data: roadmap } = useRoadmap();

  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);

  return (
    <div className="flex h-full flex-col">
      <div className="brand-edge flex h-14 items-center border-b border-border px-4">
        <Link href="/app" aria-label={t("product.name")} onClick={onNavigate}>
          <Wordmark />
        </Link>
      </div>

      {/* Journey state — the student's position, always visible */}
      <div className="mx-3 mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3.5">
        <p className="micro-label">{t("journey.state.label")}</p>
        <p className="mt-1.5 text-sm font-semibold leading-snug">
          {t(`journey.stage.${student?.currentStage ?? "execute"}`)}
        </p>
        {goal && (
          <>
            <p className="mt-0.5 truncate text-xs text-muted-foreground" title={goal.title}>
              {goal.title}
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <Progress value={goal.overallProgress} size="sm" className="flex-1" />
              <span className="tabular text-xs font-medium text-muted-foreground">
                {goal.overallProgress}%
              </span>
            </div>
          </>
        )}
        <div className="mt-2.5 flex items-center gap-3 text-2xs text-muted-foreground">
          <Tooltip content={t("goal.locked.body")}>
            <span className="inline-flex items-center gap-1">
              <Lock className="size-3" aria-hidden="true" />
              {t("goal.title")}
            </span>
          </Tooltip>
          <Tooltip content={t("roadmap.locked.body")}>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="size-3" aria-hidden="true" />
              {roadmap?.locked ? t("roadmap.locked.title") : t("nav.roadmap")}
            </span>
          </Tooltip>
        </div>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.id} className="mb-4">
            <p className="micro-label px-2.5 pb-1.5">{t(section.labelKey)}</p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors focus-visible:shadow-focus focus-visible:outline-none",
                        active
                          ? "bg-primary/12 font-medium text-primary"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")}
                        aria-hidden="true"
                      />
                      {t(item.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  );
}
