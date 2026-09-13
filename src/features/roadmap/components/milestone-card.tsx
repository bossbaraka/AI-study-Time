"use client";

import { motion } from "framer-motion";
import { ChevronDown, Clock3, Link2 } from "lucide-react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckpointPanel } from "@/features/roadmap/components/checkpoint-panel";
import { LearningUnitRow } from "@/features/roadmap/components/learning-unit-row";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { DerivedUnitStatus } from "@/types/execution";
import type { Milestone, Roadmap } from "@/types/roadmap";

export interface MilestoneCardProps {
  milestone: Milestone;
  roadmap: Roadmap;
  /** Phase 7 runtime overlay: derived execution status per unit id. */
  unitStates?: Record<string, DerivedUnitStatus>;
}

function statusTone(milestone: Milestone): "primary" | "success" | "neutral" {
  if (milestone.status === "completed") return "success";
  if (milestone.status === "in_progress") return "primary";
  return "neutral";
}

/**
 * One timeline row (§22/§23): collapsed it answers "what & when";
 * expanded it answers "why, what exactly, and how do I know I'm ready".
 * The current milestone starts expanded; expansion is local view state —
 * milestone STATUS always comes from the domain.
 */
export function MilestoneCard({ milestone, roadmap, unitStates }: MilestoneCardProps) {
  const t = useT();
  const regionId = useId();
  const [expanded, setExpanded] = useState(milestone.status === "in_progress");

  const dependencies = milestone.dependencies
    .map((id) => roadmap.milestones.find((entry) => entry.id === id)?.title)
    .filter((title): title is string => Boolean(title));

  const statusKey =
    milestone.status === "completed"
      ? "completed"
      : milestone.status === "in_progress"
        ? "current"
        : "upcoming";

  return (
    <li
      aria-current={milestone.status === "in_progress" ? "step" : undefined}
      className="rounded-lg border border-border bg-surface-raised"
    >
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        aria-expanded={expanded}
        aria-controls={regionId}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-start"
      >
        <span
          className={cn(
            "tabular mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-2xs font-semibold",
            milestone.status === "in_progress" && "border-primary bg-primary text-primary-foreground",
            milestone.status === "completed" && "border-success/40 bg-success-subtle text-success-foreground",
            milestone.status === "pending" && "border-border text-muted-foreground",
          )}
          aria-hidden="true"
        >
          {milestone.order + 1}
        </span>
        <span className="flex flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {milestone.title}
            </span>
            {milestone.maintenance && (
              <Badge tone="info">{t("roadmap.milestones.maintenance")}</Badge>
            )}
            <Badge tone={statusTone(milestone)}>{t(`roadmap.milestones.status.${statusKey}`)}</Badge>
          </span>
          <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3.5" aria-hidden="true" />
              {t("roadmap.milestones.hours", { hours: milestone.estimatedHours })}
            </span>
            {dependencies.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Link2 className="size-3.5" aria-hidden="true" />
                {t("roadmap.milestones.after", { name: dependencies.join(", ") })}
              </span>
            )}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <motion.div
          id={regionId}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="flex flex-col gap-4 border-t border-border px-4 py-4"
        >
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground">
              {t("roadmap.milestones.outcomeLabel")}
            </p>
            <p className="text-sm leading-relaxed text-foreground">{milestone.learningOutcome}</p>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {milestone.goalAlignment}
          </p>
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">
              {t("roadmap.milestones.unitsLabel")}
            </p>
            <ul className="flex flex-col gap-2">
              {milestone.learningUnits.map((unit) => (
                <LearningUnitRow key={unit.id} unit={unit} status={unitStates?.[unit.id]} />
              ))}
            </ul>
          </div>
          <CheckpointPanel checkpoint={milestone.checkpoint} />
        </motion.div>
      )}
    </li>
  );
}
