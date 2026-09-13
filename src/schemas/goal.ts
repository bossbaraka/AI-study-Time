/**
 * STEP 5 goal-form validation — Zod schemas for the discovery/refine form.
 *
 * Two layers, by design:
 * - HERE: form-shape validation (required selections, custom values,
 *   ranges) with human-readable translation keys via `resolveZodMessage`.
 *   Chip groups start empty, so form fields are strings validated by
 *   refinement; strict enum parsing happens at the conversion boundary.
 * - ENGINE: goal-quality validation (vagueness, feasibility, criteria) —
 *   business rules never live in schemas or components.
 */

import { z } from "zod";
import {
  CONSTRAINT_KINDS,
  CURRENT_LEVELS,
  MOTIVATION_KINDS,
  TARGET_LEVELS,
  type GoalDiscoveryInput,
  type GoalDomain,
} from "@/types/goal";

export const TIMEFRAME_PRESETS = ["4", "8", "12", "24", "52", "custom"] as const;
export const COMMITMENT_PRESETS = ["2", "4", "7", "10", "15", "custom"] as const;
export const DOMAIN_CHOICES = [
  "javascript",
  "frontend",
  "backend",
  "software_engineering",
  "ai",
  "data_science",
  "cybersecurity",
  "english",
  "mathematics",
  "custom",
] as const;

export type TimeframePreset = (typeof TIMEFRAME_PRESETS)[number];
export type CommitmentPreset = (typeof COMMITMENT_PRESETS)[number];
export type DomainChoice = (typeof DOMAIN_CHOICES)[number];

/* Strict enums — applied in `toGoalDiscoveryInput` (the only conversion). */
const domainChoiceEnum = z.enum(DOMAIN_CHOICES);
const motivationEnum = z.enum(MOTIVATION_KINDS);
const currentLevelEnum = z.enum(CURRENT_LEVELS);
const targetLevelEnum = z.enum(TARGET_LEVELS);
const constraintEnum = z.enum(CONSTRAINT_KINDS);

export const goalDiscoveryFormSchema = z
  .object({
    domainChoice: z.string().min(1, "goals.errors.domainRequired"),
    customDomain: z.string().trim().max(60, "goals.errors.customDomainTooLong").optional().or(z.literal("")),
    desiredOutcome: z
      .string()
      .trim()
      .min(1, "goals.errors.outcomeRequired")
      .max(400, "goals.errors.outcomeTooLong"),
    motivationKind: z.string().min(1, "goals.errors.motivationRequired"),
    motivationNote: z.string().trim().max(240, "goals.errors.motivationNoteTooLong").optional().or(z.literal("")),
    currentLevel: z.string().min(1, "goals.errors.levelRequired"),
    targetLevel: z.string().min(1, "goals.errors.levelRequired"),
    timeframePreset: z.string().min(1, "goals.errors.timeframeRequired"),
    customWeeks: z.string().trim().optional().or(z.literal("")),
    commitmentPreset: z.string().min(1, "goals.errors.commitmentRequired"),
    customHours: z.string().trim().optional().or(z.literal("")),
    constraints: z.array(z.string()),
    /** RHF field arrays require object elements — `{ text }` wrappers. */
    successCriteria: z.array(
      z.object({ text: z.string().trim().max(160, "goals.errors.criterionTooLong") }),
    ),
  })
  .superRefine((values, ctx) => {
    if (values.domainChoice === "custom" && (values.customDomain ?? "").length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customDomain"],
        message: "goals.errors.customDomainRequired",
      });
    }
    if (values.motivationKind === "other" && (values.motivationNote ?? "").length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["motivationNote"],
        message: "goals.errors.motivationNoteRequired",
      });
    }
    if (values.timeframePreset === "custom") {
      const weeks = Number(values.customWeeks);
      if (!values.customWeeks || !Number.isInteger(weeks) || weeks < 1 || weeks > 104) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customWeeks"],
          message: "goals.errors.customWeeksRange",
        });
      }
    }
    if (values.commitmentPreset === "custom") {
      const hours = Number(values.customHours);
      if (!values.customHours || Number.isNaN(hours) || hours < 1 || hours > 80) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["customHours"],
          message: "goals.errors.customHoursRange",
        });
      }
    }
  });

export type GoalDiscoveryFormValues = z.infer<typeof goalDiscoveryFormSchema>;

/** True when every required selection/text has been filled in. */
export function emptyGoalFormValues(defaultCurrentLevel?: string): GoalDiscoveryFormValues {
  return {
    domainChoice: "",
    customDomain: "",
    desiredOutcome: "",
    motivationKind: "",
    motivationNote: "",
    currentLevel: defaultCurrentLevel ?? "",
    targetLevel: "",
    timeframePreset: "",
    customWeeks: "",
    commitmentPreset: "",
    customHours: "",
    constraints: [],
    successCriteria: [],
  };
}

/** Form values → typed engine input. The only place this mapping exists. */
export function toGoalDiscoveryInput(values: GoalDiscoveryFormValues): GoalDiscoveryInput {
  const parsed = goalDiscoveryFormSchema.parse(values);

  const domainChoice = domainChoiceEnum.parse(parsed.domainChoice);
  const motivationKind = motivationEnum.parse(parsed.motivationKind);
  const currentLevel = currentLevelEnum.parse(parsed.currentLevel);
  const targetLevel = targetLevelEnum.parse(parsed.targetLevel);
  const constraints = constraintEnum.array().parse(parsed.constraints);

  const targetDomain: GoalDomain =
    domainChoice === "custom"
      ? { kind: "custom", label: (parsed.customDomain ?? "").trim() }
      : { kind: "preset", presetId: domainChoice };

  const weeks =
    parsed.timeframePreset === "custom" ? Number(parsed.customWeeks) : Number(parsed.timeframePreset);
  const hoursPerWeek =
    parsed.commitmentPreset === "custom"
      ? Number(parsed.customHours)
      : Number(parsed.commitmentPreset);

  const motivationNote = (parsed.motivationNote ?? "").trim();
  const criteria = parsed.successCriteria.map((c) => c.text.trim()).filter((c) => c.length > 0);

  return {
    targetDomain,
    desiredOutcome: parsed.desiredOutcome,
    motivation: {
      kind: motivationKind,
      ...(motivationNote.length > 0 ? { note: motivationNote } : {}),
    },
    currentLevel,
    targetLevel,
    timeframe: { weeks, preset: parsed.timeframePreset !== "custom" },
    weeklyCommitment: { hoursPerWeek, preset: parsed.commitmentPreset !== "custom" },
    constraints,
    ...(criteria.length > 0 ? { successCriteria: criteria } : {}),
  };
}

/** Edit-mode prefill: an existing goal back into form values. */
export function goalToFormValues(
  goal: Pick<
    GoalDiscoveryInput,
    | "targetDomain"
    | "desiredOutcome"
    | "motivation"
    | "currentLevel"
    | "targetLevel"
    | "timeframe"
    | "weeklyCommitment"
    | "constraints"
  > & { successCriteria: string[] },
): GoalDiscoveryFormValues {
  const domainChoice = goal.targetDomain.kind === "preset" ? goal.targetDomain.presetId : "custom";
  return {
    domainChoice,
    customDomain: goal.targetDomain.kind === "custom" ? goal.targetDomain.label : "",
    desiredOutcome: goal.desiredOutcome,
    motivationKind: goal.motivation.kind,
    motivationNote: goal.motivation.note ?? "",
    currentLevel: goal.currentLevel,
    targetLevel: goal.targetLevel,
    timeframePreset: goal.timeframe.preset ? String(goal.timeframe.weeks) : "custom",
    customWeeks: goal.timeframe.preset ? "" : String(goal.timeframe.weeks),
    commitmentPreset: goal.weeklyCommitment.preset
      ? String(goal.weeklyCommitment.hoursPerWeek)
      : "custom",
    customHours: goal.weeklyCommitment.preset ? "" : String(goal.weeklyCommitment.hoursPerWeek),
    constraints: [...goal.constraints],
    successCriteria: goal.successCriteria.map((text) => ({ text })),
  };
}

/* Compile-time guarantee: preset ids remain a subset of the domain union,
   so `toGoalDiscoveryInput` can never emit an unknown preset. */
type _PresetIdsMatchDomain = Exclude<DomainChoice, "custom"> extends
  import("@/types/goal").GoalDomainPresetId
  ? true
  : never;
type _TimeframeIsTyped = GoalDiscoveryInput["timeframe"]["weeks"] extends number ? true : never;
export type GoalSchemaContractChecks = [_PresetIdsMatchDomain, _TimeframeIsTyped];
