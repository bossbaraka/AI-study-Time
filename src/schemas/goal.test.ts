/**
 * Goal form schema: form-shape validation with translation-key messages,
 * and the single typed boundary (toGoalDiscoveryInput) into the engine.
 * Quality rules live in the engine — never here.
 */

import { describe, expect, it } from "vitest";
import {
  emptyGoalFormValues,
  goalDiscoveryFormSchema,
  goalToFormValues,
  toGoalDiscoveryInput,
  type GoalDiscoveryFormValues,
} from "@/schemas/goal";

function filledValues(overrides: Partial<GoalDiscoveryFormValues> = {}): GoalDiscoveryFormValues {
  return {
    ...emptyGoalFormValues(),
    domainChoice: "backend",
    desiredOutcome: "Build and deploy two practical backend apps",
    motivationKind: "career",
    currentLevel: "developing",
    targetLevel: "build_independently",
    timeframePreset: "12",
    commitmentPreset: "7",
    ...overrides,
  };
}

describe("goalDiscoveryFormSchema — required selections", () => {
  it("starts empty: no chip group is preselected (student decides)", () => {
    const values = emptyGoalFormValues();
    expect(values.domainChoice).toBe("");
    expect(values.motivationKind).toBe("");
    expect(values.targetLevel).toBe("");
    expect(values.timeframePreset).toBe("");
    expect(values.commitmentPreset).toBe("");
    const result = goalDiscoveryFormSchema.safeParse(values);
    expect(result.success).toBe(false);
  });

  it("accepts the diagnosis prefill for current level only", () => {
    const values = emptyGoalFormValues("developing");
    expect(values.currentLevel).toBe("developing");
    expect(values.targetLevel).toBe("");
  });

  it("accepts a fully filled form", () => {
    expect(goalDiscoveryFormSchema.safeParse(filledValues()).success).toBe(true);
  });

  it("reports keyed, translatable messages for missing fields", () => {
    const result = goalDiscoveryFormSchema.safeParse(emptyGoalFormValues());
    expect(result.success).toBe(false);
    if (result.success) return;
    const messages = result.error.issues.map((issue) => issue.message);
    expect(messages).toContain("goals.errors.domainRequired");
    expect(messages).toContain("goals.errors.outcomeRequired");
    expect(messages).toContain("goals.errors.motivationRequired");
    expect(messages).toContain("goals.errors.timeframeRequired");
    expect(messages).toContain("goals.errors.commitmentRequired");
  });
});

describe("goalDiscoveryFormSchema — conditional custom fields", () => {
  it("requires a name when the custom domain is chosen", () => {
    const result = goalDiscoveryFormSchema.safeParse(
      filledValues({ domainChoice: "custom", customDomain: "  " }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toContain("goals.errors.customDomainRequired");
  });

  it("requires a note when motivation is 'other'", () => {
    const result = goalDiscoveryFormSchema.safeParse(
      filledValues({ motivationKind: "other", motivationNote: "" }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toContain("goals.errors.motivationNoteRequired");
  });

  it("bounds custom weeks to whole numbers between 1 and 104", () => {
    for (const customWeeks of ["", "0", "200", "12.5", "abc"]) {
      const result = goalDiscoveryFormSchema.safeParse(
        filledValues({ timeframePreset: "custom", customWeeks }),
      );
      expect(result.success, `weeks=${customWeeks}`).toBe(false);
    }
    expect(
      goalDiscoveryFormSchema.safeParse(
        filledValues({ timeframePreset: "custom", customWeeks: "16" }),
      ).success,
    ).toBe(true);
  });

  it("bounds custom hours between 1 and 80", () => {
    expect(
      goalDiscoveryFormSchema.safeParse(
        filledValues({ commitmentPreset: "custom", customHours: "0" }),
      ).success,
    ).toBe(false);
    expect(
      goalDiscoveryFormSchema.safeParse(
        filledValues({ commitmentPreset: "custom", customHours: "6" }),
      ).success,
    ).toBe(true);
  });

  it("caps long text with keyed messages", () => {
    const result = goalDiscoveryFormSchema.safeParse(
      filledValues({ successCriteria: [{ text: "x".repeat(161) }] }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.message)).toContain("goals.errors.criterionTooLong");
  });
});

describe("toGoalDiscoveryInput — the typed conversion boundary", () => {
  it("maps presets to numbers and flags them as presets", () => {
    const input = toGoalDiscoveryInput(filledValues());
    expect(input.targetDomain).toEqual({ kind: "preset", presetId: "backend" });
    expect(input.timeframe).toEqual({ weeks: 12, preset: true });
    expect(input.weeklyCommitment).toEqual({ hoursPerWeek: 7, preset: true });
    expect(input.motivation).toEqual({ kind: "career" });
  });

  it("maps custom domain, weeks and hours", () => {
    const input = toGoalDiscoveryInput(
      filledValues({
        domainChoice: "custom",
        customDomain: " Game development ",
        timeframePreset: "custom",
        customWeeks: "16",
        commitmentPreset: "custom",
        customHours: "6",
        motivationKind: "other",
        motivationNote: " I love games ",
      }),
    );
    expect(input.targetDomain).toEqual({ kind: "custom", label: "Game development" });
    expect(input.timeframe).toEqual({ weeks: 16, preset: false });
    expect(input.weeklyCommitment).toEqual({ hoursPerWeek: 6, preset: false });
    expect(input.motivation).toEqual({ kind: "other", note: "I love games" });
  });

  it("unwraps criteria objects and drops empty entries", () => {
    const input = toGoalDiscoveryInput(
      filledValues({
        successCriteria: [{ text: " Ship app one " }, { text: "  " }, { text: "" }],
      }),
    );
    expect(input.successCriteria).toEqual(["Ship app one"]);
  });

  it("omits successCriteria entirely when empty (engine drafts them)", () => {
    const input = toGoalDiscoveryInput(filledValues({ successCriteria: [] }));
    expect("successCriteria" in input).toBe(false);
  });
});

describe("goalToFormValues — edit-mode round trip", () => {
  it("maps a goal back into form values losslessly", () => {
    const input = toGoalDiscoveryInput(
      filledValues({
        domainChoice: "custom",
        customDomain: "Python",
        timeframePreset: "custom",
        customWeeks: "16",
        commitmentPreset: "custom",
        customHours: "6",
        constraints: ["work"],
        successCriteria: [{ text: "Ship two apps" }],
      }),
    );
    const goal = { ...input, successCriteria: input.successCriteria ?? [] };
    const values = goalToFormValues(goal);
    expect(values.domainChoice).toBe("custom");
    expect(values.customDomain).toBe("Python");
    expect(values.timeframePreset).toBe("custom");
    expect(values.customWeeks).toBe("16");
    expect(values.commitmentPreset).toBe("custom");
    expect(values.customHours).toBe("6");
    expect(values.constraints).toEqual(["work"]);
    expect(values.successCriteria).toEqual([{ text: "Ship two apps" }]);
    // Round trip is stable.
    expect(toGoalDiscoveryInput(values)).toEqual(input);
  });

  it("maps preset goals back to preset chips", () => {
    const input = toGoalDiscoveryInput(filledValues());
    const values = goalToFormValues({ ...input, successCriteria: [] });
    expect(values.timeframePreset).toBe("12");
    expect(values.customWeeks).toBe("");
    expect(values.commitmentPreset).toBe("7");
  });
});
