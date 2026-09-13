"use client";

import { BookOpen, Compass, Flag, Hammer, RefreshCw, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/provider";
import { formatDuration } from "@/lib/utils";
import type { DerivedUnitStatus } from "@/types/execution";
import type { LearningUnit } from "@/types/roadmap";

type BadgeTone = NonNullable<BadgeProps["tone"]>;

export const UNIT_ICONS: Record<LearningUnit["type"], LucideIcon> = {
  learn: BookOpen,
  practice: Compass,
  build: Hammer,
  review: RefreshCw,
  reflect: Search,
  assess: Flag,
};

/**
 * Runtime execution overlay (Phase 7, §14): the plan never changes —
 * only a small honest state badge appears once the student has acted.
 * available/blocked intentionally render no badge (calm timeline).
 */
const EXECUTION_BADGE_TONES: Partial<Record<DerivedUnitStatus, BadgeTone>> = {
  in_progress: "primary",
  submitted: "info",
  passed: "success",
  needs_review: "warning",
  failed: "danger",
};

export interface LearningUnitRowProps {
  unit: LearningUnit;
  /** Derived execution status — runtime overlay, never curriculum state. */
  status?: DerivedUnitStatus;
}

/**
 * One learning unit (§24): what, why, how long, what outcome, and what
 * evidence shows completion — learning, not passive consumption.
 */
export function LearningUnitRow({ unit, status }: LearningUnitRowProps) {
  const t = useT();
  const Icon = UNIT_ICONS[unit.type];
  const badgeTone = status ? EXECUTION_BADGE_TONES[status] : undefined;

  return (
    <li className="flex flex-col gap-1.5 rounded-md border border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">
          <Icon aria-hidden="true" />
          {t(`roadmap.units.types.${unit.type}`)}
        </Badge>
        <p className="text-sm font-medium text-foreground">{unit.title}</p>
        {status && badgeTone && (
          <Badge tone={badgeTone}>{t(`execution.status.${status}`)}</Badge>
        )}
        <span className="tabular ms-auto text-xs text-muted-foreground">
          {formatDuration(unit.estimatedMinutes)}
        </span>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{unit.purpose}</p>
      <p className="text-xs leading-relaxed text-foreground">
        <span className="font-medium">{t("roadmap.units.outcome")}: </span>
        {unit.expectedOutcome}
      </p>
      <p className="text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">{t("roadmap.units.evidence")}: </span>
        {unit.completionEvidence}
      </p>
    </li>
  );
}
