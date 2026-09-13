/**
 * Applies a goal suggestion as an explicit, typed patch.
 * The student always triggers this (a "use suggestion" click) — the
 * system never overwrites user input on its own (§11).
 */

import type { GoalRefinePatch, GoalSuggestion } from "@/types/goal";

export function patchForSuggestion(suggestion: GoalSuggestion): GoalRefinePatch | null {
  switch (suggestion.field) {
    case "desiredOutcome":
      return suggestion.payload.outcome
        ? { desiredOutcome: suggestion.payload.outcome }
        : null;
    case "timeframe":
      return suggestion.payload.weeks
        ? { timeframe: { weeks: suggestion.payload.weeks, preset: false } }
        : null;
    case "successCriteria":
      return suggestion.payload.criteria ? { successCriteria: suggestion.payload.criteria } : null;
  }
}
