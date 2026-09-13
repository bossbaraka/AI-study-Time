"use client";

import { CalendarRange, Gauge, Layers, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useT } from "@/lib/i18n/provider";
import type { Roadmap } from "@/types/roadmap";

export interface RoadmapOverviewProps {
  roadmap: Roadmap;
}

const FEASIBILITY_TONES = {
  fits: "success",
  tight: "warning",
  exceeds: "danger",
} as const;

/**
 * Roadmap overview (§15/§22): duration, weekly commitment, total effort
 * and an HONEST qualitative budget verdict — never a fabricated score.
 */
export function RoadmapOverview({ roadmap }: RoadmapOverviewProps) {
  const t = useT();
  const { availableHours, requiredHours } = roadmap.generationContext;

  const stats = [
    {
      icon: CalendarRange,
      label: t("roadmap.overview.duration"),
      value: t(`roadmap.overview.durationValue.${roadmap.estimatedDuration.unit}`, {
        value: roadmap.estimatedDuration.value,
      }),
    },
    {
      icon: Timer,
      label: t("roadmap.overview.weekly"),
      value: t("goal.commitmentValue", { hours: roadmap.weeklyCommitment }),
    },
    {
      icon: Gauge,
      label: t("roadmap.overview.totalEffort"),
      value: t("roadmap.overview.hoursValue", { hours: roadmap.totalEstimatedHours }),
    },
    {
      icon: Layers,
      label: t("roadmap.overview.milestones"),
      value: t("roadmap.overview.milestoneCount", { count: roadmap.milestones.length }),
    },
  ];

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <p className="text-sm leading-relaxed text-muted-foreground">{roadmap.description}</p>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex flex-col gap-0.5">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <stat.icon className="size-3.5" aria-hidden="true" />
                {stat.label}
              </dt>
              <dd className="tabular text-sm font-semibold text-foreground">{stat.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <p className="flex items-center gap-2 text-xs font-medium text-foreground">
            {t("roadmap.feasibility.label")}
            <Badge tone={FEASIBILITY_TONES[roadmap.timeFeasibility]}>
              {t(`roadmap.feasibility.${roadmap.timeFeasibility}`)}
            </Badge>
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(`roadmap.feasibility.${roadmap.timeFeasibility}.body`, {
              required: requiredHours,
              available: availableHours,
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
