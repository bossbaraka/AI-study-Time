"use client";

import { Check } from "lucide-react";
import { GOAL_KEY_PREFIXES } from "@/features/goals/constants/goal-discovery.constants";
import { useT } from "@/lib/i18n/provider";
import type { LearningGoal } from "@/types/goal";

export interface GoalSummaryProps {
  goal: LearningGoal;
}

/**
 * The calm goal summary shared by the review and locked screens.
 * Every label is a translation key; custom domain text is student content.
 */
export function GoalSummary({ goal }: GoalSummaryProps) {
  const t = useT();
  const domainLabel =
    goal.targetDomain.kind === "preset"
      ? t(`${GOAL_KEY_PREFIXES.domain}${goal.targetDomain.presetId}`)
      : goal.targetDomain.label;
  const motivationNote = goal.motivation.note;

  const rows: { label: string; value: string }[] = [
    {
      label: t("goals.review.domain"),
      value: domainLabel,
    },
    {
      label: t("goals.review.why"),
      value: motivationNote
        ? `${t(`${GOAL_KEY_PREFIXES.motivation}${goal.motivation.kind}`)} — ${motivationNote}`
        : t(`${GOAL_KEY_PREFIXES.motivation}${goal.motivation.kind}`),
    },
    {
      label: t("goals.review.currentLevel"),
      value: t(`${GOAL_KEY_PREFIXES.currentLevel}${goal.currentLevel}`),
    },
    {
      label: t("goals.review.targetLevel"),
      value: t(`${GOAL_KEY_PREFIXES.targetLevel}${goal.targetLevel}`),
    },
    {
      label: t("goals.review.timeframe"),
      value: t("goals.review.timeframeValue", { weeks: goal.timeframe.weeks }),
    },
    {
      label: t("goals.review.commitment"),
      value: t("goal.commitmentValue", { hours: goal.weeklyCommitment.hoursPerWeek }),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <p className="text-lg font-medium leading-relaxed tracking-tight">{goal.desiredOutcome}</p>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-0.5">
            <dt className="text-xs text-muted-foreground">{row.label}</dt>
            <dd className="text-sm font-medium text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>

      {goal.constraints.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">{t("goals.review.constraints")}</p>
          <ul className="flex flex-wrap gap-1.5">
            {goal.constraints.map((constraint) => (
              <li
                key={constraint}
                className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground"
              >
                {t(`${GOAL_KEY_PREFIXES.constraint}${constraint}`)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {goal.successCriteria.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{t("goals.review.criteria")}</p>
          <ul className="flex flex-col gap-1.5">
            {goal.successCriteria.map((criterion) => (
              <li key={criterion} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                {criterion}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
