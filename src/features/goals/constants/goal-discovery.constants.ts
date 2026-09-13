/**
 * Goal discovery presentation constants.
 * Option *ids* live here; every visible label is an i18n key resolved at
 * render time (no hardcoded strings, RTL-safe by construction).
 */

import {
  CONSTRAINT_KINDS,
  CURRENT_LEVELS,
  MOTIVATION_KINDS,
  TARGET_LEVELS,
  type ConstraintKind,
  type CurrentLevel,
  type MotivationKind,
  type TargetLevel,
} from "@/types/goal";
import {
  COMMITMENT_PRESETS,
  DOMAIN_CHOICES,
  TIMEFRAME_PRESETS,
  type CommitmentPreset,
  type DomainChoice,
  type TimeframePreset,
} from "@/schemas/goal";

export const GOAL_KEY_PREFIXES = {
  domain: "goals.domains.",
  motivation: "goals.motivations.",
  currentLevel: "goals.levels.current.",
  targetLevel: "goals.levels.target.",
  timeframe: "goals.timeframes.",
  commitment: "goals.commitments.",
  constraint: "goals.constraints.",
  issue: "goals.issues.",
  dimension: "goals.dimensions.",
  verdict: "goals.quality.",
} as const;

export const DOMAIN_OPTIONS: readonly DomainChoice[] = DOMAIN_CHOICES;
export const MOTIVATION_OPTIONS: readonly MotivationKind[] = MOTIVATION_KINDS;
export const CURRENT_LEVEL_OPTIONS: readonly CurrentLevel[] = CURRENT_LEVELS;
export const TARGET_LEVEL_OPTIONS: readonly TargetLevel[] = TARGET_LEVELS;
export const TIMEFRAME_OPTIONS: readonly TimeframePreset[] = TIMEFRAME_PRESETS;
export const COMMITMENT_OPTIONS: readonly CommitmentPreset[] = COMMITMENT_PRESETS;
export const CONSTRAINT_OPTIONS: readonly ConstraintKind[] = CONSTRAINT_KINDS;

/**
 * Maps the Phase 4 diagnosis to a starting suggestion for "current level".
 * Deterministic and advisory only — the student always decides (§8/§27).
 */
export function suggestedCurrentLevel(diagnosis: {
  knowledgeGaps: unknown[];
  developingAreas: unknown[];
  strengths: unknown[];
} | null): CurrentLevel | undefined {
  if (!diagnosis) return undefined;
  if (diagnosis.knowledgeGaps.length > 0) return "basic_familiarity";
  if (diagnosis.developingAreas.length > 0) return "developing";
  if (diagnosis.strengths.length > 0) return "comfortable";
  return undefined;
}
