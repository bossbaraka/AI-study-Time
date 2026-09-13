"use client";

import { Crosshair, Flag, LifeBuoy, Map, Target, TimerOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { MentorChat } from "@/features/mentor/components/mentor-chat";
import { useMentorContext } from "@/features/intelligence/hooks/use-intelligence";
import { useT } from "@/lib/i18n/provider";


/**
 * AI Mentor — the context panel is the differentiator:
 * the mentor visibly knows the goal, phase, task, performance,
 * weaknesses, delays and recovery state.
 */
export default function MentorPage() {
  const t = useT();
  const contextQuery = useMentorContext();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("mentor.title")} subtitle={t("mentor.subtitle")} />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Mentor context — always visible proof of journey awareness */}
        <aside aria-label={t("mentor.context")} className="order-2 lg:order-1">
          {contextQuery.isLoading ? (
            <PageSkeleton blocks={1} />
          ) : contextQuery.isError || !contextQuery.data ? (
            <ErrorState
              title={t("state.error.title")}
              body={t("state.error.body")}
              onRetry={() => void contextQuery.refetch()}
            />
          ) : (
            <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-5">
              <p className="micro-label mb-3">{t("mentor.context")}</p>
              <ContextRow icon={Target} label={t("mentor.context.goal")} value={contextQuery.data.goalTitle} />
              <ContextRow icon={Map} label={t("mentor.context.phase")} value={contextQuery.data.phaseTitle} />
              <ContextRow icon={Crosshair} label={t("mentor.context.task")} value={contextQuery.data.currentTaskTitle} />
              <ContextRow icon={Flag} label={t("mentor.context.performance")} value={contextQuery.data.recentPerformance} />
              <div className="flex items-start gap-3 py-2.5">
                <TimerOff className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-2xs text-muted-foreground">{t("mentor.context.weaknesses")}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {contextQuery.data.weaknesses.map((w) => (
                      <Badge key={w} tone="warning">{w}</Badge>
                    ))}
                  </div>
                </div>
              </div>
              <ContextRow
                icon={TimerOff}
                label={t("mentor.context.delays")}
                value={String(contextQuery.data.recentDelays)}
              />
              <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                <span className="flex items-center gap-2 text-2xs text-muted-foreground">
                  <LifeBuoy className="size-3.5" aria-hidden="true" />
                  {t("mentor.context.recovery")}
                </span>
                <Badge tone={contextQuery.data.recoveryActive ? "info" : "neutral"}>
                  {contextQuery.data.recoveryActive ? t("recovery.active") : "—"}
                </Badge>
              </div>
            </div>
          )}
        </aside>

        <div className="order-1 lg:order-2">
          <MentorChat />
        </div>
      </div>
    </div>
  );
}

function ContextRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Target;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-border/60 py-2.5 last:border-0">
      <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-2xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-xs font-medium leading-snug">{value}</p>
      </div>
    </div>
  );
}
