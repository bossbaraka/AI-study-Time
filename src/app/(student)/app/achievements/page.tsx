"use client";

import { Award, Lock, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { SectionBlock } from "@/components/layout/section-block";
import { useAchievements } from "@/features/engagement/hooks/use-engagement";
import { useT } from "@/lib/i18n/provider";
import { cn, formatDate } from "@/lib/utils";
import type { Achievement } from "@/types/domain";


/**
 * Achievements — journey milestones only.
 * Each card states the milestone it marks, never a point value.
 */
export default function AchievementsPage() {
  const t = useT();
  const achievementsQuery = useAchievements();

  if (achievementsQuery.isLoading) return <PageSkeleton blocks={2} />;
  if (achievementsQuery.isError || !achievementsQuery.data) {
    return (
      <ErrorState
        title={t("state.error.title")}
        body={t("state.error.body")}
        onRetry={() => void achievementsQuery.refetch()}
      />
    );
  }

  const groups: { key: string; labelKey: string; items: Achievement[] }[] = [
    { key: "earned", labelKey: "achievements.earned", items: achievementsQuery.data.filter((a) => a.state === "earned") },
    { key: "in-progress", labelKey: "achievements.inProgress", items: achievementsQuery.data.filter((a) => a.state === "in-progress") },
    { key: "locked", labelKey: "achievements.locked", items: achievementsQuery.data.filter((a) => a.state === "locked") },
  ];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("achievements.title")} subtitle={t("achievements.subtitle")} />

      {groups.map((group) => (
        <SectionBlock key={group.key} label={`${t(group.labelKey)} (${group.items.length})`}>
          {group.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {group.items.map((achievement) => (
                <li
                  key={achievement.id}
                  className={cn(
                    "flex gap-4 rounded-lg border bg-surface p-5",
                    achievement.state === "earned" && "border-mastery/35",
                    achievement.state === "in-progress" && "border-border",
                    achievement.state === "locked" && "border-border opacity-65",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full border",
                      achievement.state === "earned" && "border-mastery/40 bg-mastery-subtle text-mastery",
                      achievement.state === "in-progress" && "border-primary/30 bg-primary/10 text-primary",
                      achievement.state === "locked" && "border-border bg-muted text-muted-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {achievement.state === "locked" ? (
                      <Lock className="size-4" />
                    ) : achievement.state === "earned" ? (
                      <Trophy className="size-4" />
                    ) : (
                      <Award className="size-4" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{achievement.title}</h3>
                      {achievement.state === "earned" && achievement.earnedAt && (
                        <Badge tone="mastery">{formatDate(achievement.earnedAt)}</Badge>
                      )}
                      {achievement.state === "in-progress" && (
                        <Badge tone="primary">{achievement.progress}%</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {achievement.description}
                    </p>
                    <p className="mt-2 text-2xs text-muted-foreground">{achievement.milestone}</p>
                    {achievement.state === "in-progress" && (
                      <Progress value={achievement.progress} size="sm" className="mt-2" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionBlock>
      ))}
    </div>
  );
}
