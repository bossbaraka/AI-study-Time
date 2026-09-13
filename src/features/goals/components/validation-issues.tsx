"use client";

import { CircleAlert, Lightbulb, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GOAL_KEY_PREFIXES } from "@/features/goals/constants/goal-discovery.constants";
import { useT } from "@/lib/i18n/provider";
import type { GoalSuggestion, GoalValidationResult } from "@/types/goal";

export interface ValidationIssuesProps {
  validation: GoalValidationResult;
  /** Present when the student may adopt a suggestion (refinement step). */
  onApplySuggestion?: (suggestion: GoalSuggestion) => void;
  isApplying?: boolean;
}

/**
 * Validation feedback panel: errors first, then warnings, then actionable
 * suggestions. Language is challenging-but-supportive (§10/§11/§22):
 * issues name the goal, never the student.
 */
export function ValidationIssues({
  validation,
  onApplySuggestion,
  isApplying,
}: ValidationIssuesProps) {
  const t = useT();
  const errors = validation.issues.filter((issue) => issue.severity === "error");
  const warnings = validation.issues.filter((issue) => issue.severity === "warning");

  if (errors.length === 0 && warnings.length === 0 && validation.suggestions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {errors.length > 0 && (
        <section aria-label={t("goals.validation.errorsLabel")} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold tracking-tight">
            {t("goals.validation.title")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("goals.validation.body")}</p>
          <ul className="flex flex-col gap-2">
            {errors.map((issue) => (
              <li
                key={`${issue.code}-${issue.field ?? "general"}`}
                className="flex items-start gap-2.5 rounded-md border border-danger/40 bg-danger/5 px-3 py-2.5 text-sm"
              >
                <TriangleAlert
                  className="mt-0.5 size-4 shrink-0 text-danger-foreground"
                  aria-hidden="true"
                />
                <span>{t(`${GOAL_KEY_PREFIXES.issue}${issue.code}`)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {warnings.length > 0 && (
        <section aria-label={t("goals.validation.warningsLabel")} className="flex flex-col gap-2">
          <ul className="flex flex-col gap-2">
            {warnings.map((issue) => (
              <li
                key={`${issue.code}-${issue.field ?? "general"}`}
                className="flex items-start gap-2.5 rounded-md border border-border bg-surface px-3 py-2.5 text-sm"
              >
                <CircleAlert className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-muted-foreground">
                  {t(`${GOAL_KEY_PREFIXES.issue}${issue.code}`)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {validation.suggestions.length > 0 && (
        <section aria-label={t("goals.suggestions.label")} className="flex flex-col gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <Lightbulb className="size-4 text-primary" aria-hidden="true" />
            {t("goals.suggestions.label")}
          </h2>
          <ul className="flex flex-col gap-2">
            {validation.suggestions.map((suggestion) => (
              <li key={suggestion.code}>
                <Card>
                  <CardContent className="flex flex-col gap-3 p-4">
                    <p className="text-sm font-medium text-foreground">
                      {t(`goals.suggestions.${suggestion.code}.title`)}
                    </p>
                    <p className="rounded-md border border-border bg-surface-raised px-3 py-2 text-sm leading-relaxed text-muted-foreground">
                      {suggestion.example}
                    </p>
                    {onApplySuggestion && (
                      <div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => onApplySuggestion(suggestion)}
                          disabled={isApplying}
                        >
                          {isApplying && (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          )}
                          {t("goals.suggestions.use")}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
