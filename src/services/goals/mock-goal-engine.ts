/**
 * Goal Engine — the deterministic goal domain orchestrator.
 *
 * This module is the ONLY place goal business rules live, and it has zero
 * React, storage or transport dependencies (independently testable).
 * Persistence is reached through the injected `GoalStore` port; the
 * diagnosis snapshot is handed in by the application layer, so the engine
 * never fetches across a domain boundary itself.
 *
 * Rules are deliberately simple, deterministic and explainable — no
 * natural-language understanding is pretended. Every verdict maps to a
 * documented rule below, and every suggestion is a template the student
 * may adopt or ignore. When the real engine lands, it replaces this module
 * behind the identical `goal-discovery.service.ts` contract.
 *
 * Quality model: qualitative verdicts only (strong / developing / weak).
 * No fabricated percentages — the only arithmetic is the documented
 * hours heuristic (distance between levels × hours-per-level vs. the
 * student's total available hours).
 */

import { ApiError } from "@/lib/api/client";
import { assertTransition, isEditable } from "@/services/goals/goal-state-machine";
import type { GoalStore } from "@/services/ports/stores";
import type {
  CurrentLevel,
  GoalDimensionQuality,
  GoalDiscoveryInput,
  GoalDomain,
  GoalIssueCode,
  GoalQualityVerdict,
  GoalRefinePatch,
  GoalSuggestion,
  GoalValidationIssue,
  GoalValidationResult,
  GoalWithValidation,
  LearningGoal,
  TargetLevel,
} from "@/types/goal";

/* ------------------------------------------------------------------ */
/* Rule tables (deterministic, documented, explainable)                */
/* ------------------------------------------------------------------ */

/** Phrases that signal an un-specific outcome. Exact substring matches. */
const VAGUE_PHRASES = [
  "learn more",
  "get better",
  "improve myself",
  "become better",
  "understand everything",
  "master everything",
  "learn everything",
  "know everything",
] as const;

/** Filler words stripped when detecting topic-only goals. */
const FILLER_WORDS = new Set([
  "i", "want", "to", "learn", "study", "master", "understand", "know", "get",
  "good", "at", "the", "a", "an", "more", "about", "of", "in", "everything",
  "all", "my", "some",
]);

/** Words that make an outcome measurable (alongside any digit). */
const MEASURABLE_WORDS = [
  "project", "projects", "app", "apps", "application", "applications",
  "deploy", "ship", "release", "publish", "build", "pass", "exam", "score",
  "portfolio", "complete", "deliver", "launch",
] as const;

/** Outcome verbs that indicate an ability-oriented (strong) phrasing. */
const ACTION_STARTERS = [
  "build", "create", "design", "implement", "develop", "ship", "deploy",
  "write", "deliver", "launch", "pass", "complete", "become", "teach",
  "solve", "contribute",
] as const;

const DOMAIN_LABELS_EN: Record<string, string> = {
  javascript: "JavaScript",
  frontend: "frontend development",
  backend: "backend development",
  software_engineering: "software engineering",
  ai: "AI",
  data_science: "data science",
  cybersecurity: "cybersecurity",
  english: "English",
  mathematics: "mathematics",
};

/** Domains the Phase 4 JS-focused diagnosis can speak to. */
const DIAGNOSIS_ALIGNED_DOMAINS = new Set([
  "javascript", "frontend", "backend", "software_engineering",
]);

/** Current level → position on the target-level scale (hours heuristic). */
const CURRENT_ON_TARGET_SCALE: Record<CurrentLevel, number> = {
  new_to_it: 0,
  basic_familiarity: 0,
  developing: 1,
  comfortable: 2,
  advanced: 3,
};

const TARGET_INDEX: Record<TargetLevel, number> = {
  understand_fundamentals: 0,
  build_independently: 1,
  build_production_quality: 2,
  work_professionally: 3,
  teach_explain: 4,
  master_advanced: 5,
};

/** Mock heuristic constants — a real engine replaces these with evidence. */
const HOURS_PER_LEVEL_STEP = 60;
const BASE_HOURS = 20;
const AGGRESSIVE_RATIO = 0.75; // below this share of needed hours → warning
const UNREALISTIC_RATIO = 0.4; // below this share with a long distance → error

function fail(status: number, code: string): never {
  throw new ApiError(code, status, code);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function domainLabel(domain: GoalDomain): string {
  return domain.kind === "custom" ? domain.label : (DOMAIN_LABELS_EN[domain.presetId] ?? domain.presetId);
}

function newGoalId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `goal_${random}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Total hours the student can realistically invest. */
function totalHours(goal: Pick<LearningGoal, "timeframe" | "weeklyCommitment">): number {
  return goal.timeframe.weeks * goal.weeklyCommitment.hoursPerWeek;
}

/** Level distance on the target scale (0–5). */
function levelDistance(goal: Pick<LearningGoal, "currentLevel" | "targetLevel">): number {
  return Math.max(0, TARGET_INDEX[goal.targetLevel] - CURRENT_ON_TARGET_SCALE[goal.currentLevel]);
}

function requiredHours(goal: Pick<LearningGoal, "currentLevel" | "targetLevel">): number {
  return BASE_HOURS + levelDistance(goal) * HOURS_PER_LEVEL_STEP;
}

/** Engine-drafted success criteria — deterministic templates, student-editable. */
function draftCriteria(targetLevel: TargetLevel, domain: string): string[] {
  switch (targetLevel) {
    case "understand_fundamentals":
      return [
        `Explain the core ${domain} concepts in my own words`,
        `Complete guided ${domain} exercises covering the fundamentals`,
      ];
    case "build_independently":
      return [
        `Plan and build a small ${domain} project without following a tutorial`,
        `Finish it to a working state and note what I would improve`,
      ];
    case "build_production_quality":
      return [
        `Build and deploy a ${domain} project with automated tests`,
        `Apply a clean structure and document my key decisions`,
      ];
    case "work_professionally":
      return [
        `Build and deploy two practical ${domain} applications`,
        `Write tests and explain my architectural decisions`,
        `Share my work for review (peer, mentor or community)`,
      ];
    case "teach_explain":
      return [
        `Teach a core ${domain} concept to someone else`,
        `Write or record an explanation others can follow`,
      ];
    case "master_advanced":
      return [
        `Solve three advanced ${domain} problems end to end`,
        `Build something that uses advanced ${domain} concepts deliberately`,
      ];
  }
}

/* ------------------------------------------------------------------ */
/* Validation (pure)                                                   */
/* ------------------------------------------------------------------ */

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function containsDigitOrNumberWord(text: string): boolean {
  if (/\d/.test(text)) return true;
  const numberWords = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  const textWords = words(text);
  return textWords.some((w) => numberWords.includes(w));
}

function evaluate(goal: LearningGoal): GoalValidationResult {
  const issues: GoalValidationIssue[] = [];
  const suggestions: GoalSuggestion[] = [];
  const outcome = goal.desiredOutcome.trim();
  const outcomeLower = outcome.toLowerCase();
  const label = domainLabel(goal.targetDomain);
  const distance = levelDistance(goal);
  const needed = requiredHours(goal);
  const available = totalHours(goal);

  const add = (code: GoalIssueCode, severity: "error" | "warning", field?: GoalValidationIssue["field"]) => {
    issues.push({ code, severity, ...(field ? { field } : {}) });
  };

  /* --- Outcome: missing / vague / topic-only ----------------------- */
  if (outcome.length === 0) {
    add("outcome_missing", "error", "desiredOutcome");
  } else {
    if (VAGUE_PHRASES.some((phrase) => outcomeLower.includes(phrase))) {
      add("outcome_vague", "error", "desiredOutcome");
    } else if (outcome.length < 15) {
      add("outcome_vague", "error", "desiredOutcome");
    }
    const meaningful = words(outcome).filter(
      (w) => !FILLER_WORDS.has(w) && !words(label).includes(w),
    );
    if (meaningful.length === 0) {
      add("topic_only", "error", "desiredOutcome");
    }
  }

  /* --- Domain ------------------------------------------------------ */
  if (goal.targetDomain.kind === "custom" && goal.targetDomain.label.trim().length === 0) {
    add("custom_domain_missing", "error", "targetDomain");
  }

  /* --- Success criteria -------------------------------------------- */
  const criteria = goal.successCriteria.map((c) => c.trim()).filter((c) => c.length > 0);
  if (criteria.length === 0) {
    add("criteria_missing", "error", "successCriteria");
    const drafted = draftCriteria(goal.targetLevel, label);
    suggestions.push({
      code: "draft_criteria",
      field: "successCriteria",
      example: drafted.join(" · "),
      payload: { criteria: drafted },
    });
  }

  /* --- Timeframe & commitment -------------------------------------- */
  if (goal.timeframe.weeks <= 0) add("timeframe_missing", "error", "timeframe");
  if (goal.weeklyCommitment.hoursPerWeek <= 0) add("commitment_missing", "error", "weeklyCommitment");

  const targetIdx = TARGET_INDEX[goal.targetLevel];
  if (goal.timeframe.weeks > 0 && targetIdx >= 3 && goal.timeframe.weeks <= 4) {
    // e.g. "work professionally / master … in 2–4 weeks"
    add("unrealistic_timeframe", "error", "timeframe");
  } else if (distance >= 3 && available < needed * UNREALISTIC_RATIO) {
    add("unrealistic_timeframe", "error", "timeframe");
  } else if (available < needed * AGGRESSIVE_RATIO) {
    add("timeline_aggressive", "warning", "timeframe");
  }

  if (distance >= 3 && goal.weeklyCommitment.hoursPerWeek > 0 && goal.weeklyCommitment.hoursPerWeek <= 2) {
    add("commitment_insufficient", "warning", "weeklyCommitment");
  }

  /* --- Measurability ------------------------------------------------ */
  const measurable =
    containsDigitOrNumberWord(outcome) ||
    words(outcome).some((w) => (MEASURABLE_WORDS as readonly string[]).includes(w)) ||
    criteria.some((c) => containsDigitOrNumberWord(c));
  if (outcome.length > 0 && !measurable) {
    add("not_measurable", "warning", "desiredOutcome");
  }

  /* --- Outcome-strengthening suggestion ------------------------------ */
  const outcomeIsWeak =
    issues.some((i) => i.field === "desiredOutcome" && i.severity === "error") ||
    outcome.length < 30;
  if (outcomeIsWeak && outcome.length > 0) {
    const example = outcomeExample(goal.targetLevel, label, goal.timeframe.weeks);
    suggestions.push({
      code: "concrete_outcome",
      field: "desiredOutcome",
      example,
      payload: { outcome: example },
    });
  }
  if (!measurable && outcome.length > 0) {
    const example = `Complete and deploy two practical ${label} projects within ${goal.timeframe.weeks > 0 ? goal.timeframe.weeks : 12} weeks.`;
    suggestions.push({
      code: "measurable_outcome",
      field: "desiredOutcome",
      example,
      payload: { outcome: example },
    });
  }
  if (issues.some((i) => i.code === "timeline_aggressive" || i.code === "unrealistic_timeframe")) {
    const hours = Math.max(goal.weeklyCommitment.hoursPerWeek, 1);
    const suggestedWeeks = Math.min(104, Math.max(4, Math.ceil(needed / hours / 4) * 4));
    suggestions.push({
      code: "realistic_window",
      field: "timeframe",
      example: `${suggestedWeeks} weeks at ${hours}+ hours/week`,
      payload: { weeks: suggestedWeeks },
    });
  }

  /* --- Quality verdicts (qualitative only) ---------------------------- */
  const firstWord = words(outcome)[0] ?? "";
  const startsWithAction =
    (ACTION_STARTERS as readonly string[]).includes(firstWord) ||
    outcomeLower.startsWith("be able") ||
    outcomeLower.startsWith("become capable");

  const clarity: GoalQualityVerdict =
    outcome.length >= 20 && startsWithAction && !issues.some((i) => i.code === "outcome_vague")
      ? "strong"
      : outcome.length >= 20
        ? "developing"
        : "weak";
  const specificity: GoalQualityVerdict = issues.some(
    (i) => i.code === "topic_only" || i.code === "outcome_vague",
  )
    ? "weak"
    : outcome.length >= 30 && measurable
      ? "strong"
      : "developing";
  const measurability: GoalQualityVerdict = measurable ? "strong" : "weak";
  const timeframeVerdict: GoalQualityVerdict = issues.some((i) => i.code === "unrealistic_timeframe")
    ? "weak"
    : issues.some((i) => i.code === "timeline_aggressive")
      ? "developing"
      : "strong";
  const commitmentVerdict: GoalQualityVerdict = issues.some((i) => i.code === "commitment_insufficient")
    ? "developing"
    : goal.weeklyCommitment.hoursPerWeek > 0
      ? "strong"
      : "weak";
  const feasibility: GoalQualityVerdict =
    timeframeVerdict === "weak" ? "weak" : timeframeVerdict === "developing" ? "developing" : "strong";

  // Alignment informs, never dictates (§8/§27): mismatch is never an issue.
  const diagnosis = goal.diagnosisContext;
  const alignment: GoalQualityVerdict =
    diagnosis === null
      ? "developing"
      : goal.targetDomain.kind === "preset" && DIAGNOSIS_ALIGNED_DOMAINS.has(goal.targetDomain.presetId)
        ? "strong"
        : "developing";

  const outcomeQuality: GoalQualityVerdict =
    clarity === "strong" && specificity !== "weak"
      ? "strong"
      : clarity === "weak" || specificity === "weak"
        ? "weak"
        : "developing";

  const quality: GoalDimensionQuality[] = [
    { dimension: "clarity", verdict: clarity },
    { dimension: "specificity", verdict: specificity },
    { dimension: "measurability", verdict: measurability },
    { dimension: "feasibility", verdict: feasibility },
    { dimension: "timeframe", verdict: timeframeVerdict },
    { dimension: "commitment", verdict: commitmentVerdict },
    { dimension: "alignment", verdict: alignment },
    { dimension: "outcome", verdict: outcomeQuality },
  ];

  const hasError = issues.some((i) => i.severity === "error");
  const hasWarning = issues.some((i) => i.severity === "warning");

  return {
    valid: !hasError,
    issues,
    quality,
    overall: hasError ? "not_ready" : hasWarning ? "needs_refinement" : "ready",
    suggestions,
    evaluatedAt: nowIso(),
  };
}

function outcomeExample(targetLevel: TargetLevel, label: string, weeks: number): string {
  const window = weeks > 0 ? ` within ${weeks} weeks` : "";
  switch (targetLevel) {
    case "understand_fundamentals":
      return `Explain the core ${label} concepts in my own words and complete a guided exercise set${window}.`;
    case "build_independently":
      return `Build a small ${label} project from scratch and finish it to a working state${window}.`;
    case "build_production_quality":
      return `Build and deploy a production-ready ${label} application with tests and documentation.`;
    case "work_professionally":
      return `Become capable of building and deploying two practical ${label} applications${window}.`;
    case "teach_explain":
      return `Teach a ${label} concept to someone else and answer their questions confidently.`;
    case "master_advanced":
      return `Solve three advanced ${label} problems and document the techniques I used.`;
  }
}

/* ------------------------------------------------------------------ */
/* Public engine API (consumed only by goal-discovery.service.ts)      */
/* ------------------------------------------------------------------ */

async function ownGoal(
  store: GoalStore,
  goalId: string,
  studentId: string,
): Promise<LearningGoal> {
  const goal = await store.findById(goalId);
  if (!goal) fail(404, "goal_not_found");
  if (goal.studentId !== studentId) fail(403, "forbidden");
  return goal;
}

/** Status the engine moves a goal to after (re)validation. */
function postValidationStatus(validation: GoalValidationResult): LearningGoal["status"] {
  return validation.valid ? "validated" : "refining";
}

export interface GoalEngineDeps {
  goals: GoalStore;
}

/** Input the APPLICATION layer resolves — never supplied by a client. */
export interface GoalCreationContext {
  studentId: string;
  idempotencyKey: string;
  /** Latest completed diagnosis for this student, or null. */
  diagnosisContext: LearningGoal["diagnosisContext"];
}

export function createGoalEngine(deps: GoalEngineDeps) {
  const store = deps.goals;

  return {
  async createGoal(
    input: GoalDiscoveryInput,
    ctx: GoalCreationContext,
  ): Promise<GoalWithValidation> {
    // Idempotent creation: a replayed request returns the original goal.
    const existing = (await store.listByStudent(ctx.studentId)).find(
      (g) => g.createIdempotencyKey === ctx.idempotencyKey,
    );
    if (existing && existing.validation) {
      return { goal: cloneGoal(existing), validation: existing.validation };
    }

    const now = nowIso();
    const goal: LearningGoal = {
      id: newGoalId(),
      studentId: ctx.studentId,
      status: "draft",
      desiredOutcome: input.desiredOutcome.trim(),
      motivation: input.motivation,
      targetDomain: input.targetDomain,
      currentLevel: input.currentLevel,
      targetLevel: input.targetLevel,
      timeframe: input.timeframe,
      weeklyCommitment: input.weeklyCommitment,
      constraints: input.constraints,
      successCriteria:
        input.successCriteria && input.successCriteria.length > 0
          ? input.successCriteria
          : draftCriteria(input.targetLevel, domainLabel(input.targetDomain)),
      // Diagnosis is resolved by the application layer from the owner's
      // own assessment history — the client never supplies it.
      diagnosisContext: ctx.diagnosisContext,
      validation: null,
      createdAt: now,
      updatedAt: now,
      lockedAt: null,
      version: 1,
      createIdempotencyKey: ctx.idempotencyKey,
    };

    assertTransition(goal.status, "discovered");
    goal.status = "discovered";

    const validation = evaluate(goal);
    goal.validation = validation;
    assertTransition(goal.status, postValidationStatus(validation));
    goal.status = postValidationStatus(validation);

    await store.upsert(goal);
    return { goal: cloneGoal(goal), validation };
  },

  async getActiveGoal(studentId: string): Promise<LearningGoal | null> {
    // Latest created goal wins; on identical timestamps (same millisecond)
    // the later-inserted goal takes precedence.
    let active: LearningGoal | undefined;
    for (const goal of await store.listByStudent(studentId)) {
      if (["abandoned", "revised", "achieved"].includes(goal.status)) continue;
      if (!active || goal.createdAt >= active.createdAt) active = goal;
    }
    return active ? cloneGoal(active) : null;
  },

  async getGoal(goalId: string, studentId: string): Promise<LearningGoal> {
    return cloneGoal(await ownGoal(store, goalId, studentId));
  },

  /**
   * Student-driven refinement. The patch comes from the student's form —
   * the engine never rewrites student input on its own (§11).
   */
  async updateGoal(
    goalId: string,
    studentId: string,
    patch: GoalRefinePatch,
  ): Promise<GoalWithValidation> {
    const goal = await ownGoal(store, goalId, studentId);
    if (!isEditable(goal.status)) fail(409, "invalid_transition");

    applyPatch(goal, patch);
    goal.updatedAt = nowIso();
    goal.version += 1;

    const validation = evaluate(goal);
    goal.validation = validation;
    const next = postValidationStatus(validation);
    if (next !== goal.status) {
      assertTransition(goal.status, next);
      goal.status = next;
    }

    await store.upsert(goal);
    return { goal: cloneGoal(goal), validation };
  },

  /** Pure re-validation; persists the fresh result on the goal. */
  async validateGoal(goalId: string, studentId: string): Promise<GoalValidationResult> {
    const goal = await ownGoal(store, goalId, studentId);
    const validation = evaluate(goal);
    goal.validation = validation;
    await store.upsert(goal);
    return validation;
  },

  /**
   * Lock: validate → confirm → persist → LOCKED (§13).
   * Idempotent: repeated locks never duplicate the transition, and a
   * failed persistence leaves the goal unlocked (§13/§14).
   */
  async lockGoal(
    goalId: string,
    studentId: string,
    idempotencyKey: string,
  ): Promise<LearningGoal> {
    const goal = await ownGoal(store, goalId, studentId);

    if (goal.status === "locked") {
      // Already locked — consistent final state, no duplicate transition.
      return cloneGoal(goal);
    }

    const validation = evaluate(goal);
    goal.validation = validation;
    if (!validation.valid) {
      await store.upsert(goal);
      fail(422, "validation_failed");
    }

    assertTransition(goal.status, "locked");
    const locked: LearningGoal = {
      ...goal,
      status: "locked",
      lockedAt: nowIso(),
      updatedAt: nowIso(),
      version: goal.version + 1,
      lockIdempotencyKey: idempotencyKey,
    };

    // Persist BEFORE reporting success: the locked state only exists once
    // the store is updated, so a failed save never yields a "fake" lock.
    // (Transport-level failures are simulated/tested at the service seam.)
    await store.upsert(locked);
    return cloneGoal(locked);
  },

  /**
   * Explicit revision of a locked/active goal (§5): the old goal becomes
   * `revised` and a fresh editable copy is created. A locked goal can
   * never silently slide back to draft.
   */
  async reviseGoal(goalId: string, studentId: string): Promise<GoalWithValidation> {
    const goal = await ownGoal(store, goalId, studentId);
    if (goal.status !== "locked" && goal.status !== "active") fail(409, "invalid_transition");

    assertTransition(goal.status, "revised");
    goal.status = "revised";
    goal.updatedAt = nowIso();

    const now = nowIso();
    const revision: LearningGoal = {
      ...cloneGoal(goal),
      id: newGoalId(),
      status: "draft",
      lockedAt: null,
      lockIdempotencyKey: undefined,
      createIdempotencyKey: undefined,
      validation: null,
      createdAt: now,
      updatedAt: now,
      version: goal.version + 1,
      revisesGoalId: goal.id,
    };
    assertTransition(revision.status, "discovered");
    revision.status = "discovered";
    const validation = evaluate(revision);
    revision.validation = validation;
    assertTransition(revision.status, postValidationStatus(validation));
    revision.status = postValidationStatus(validation);

    // Two aggregates that must agree: a goal marked `revised` with no
    // successor would leave the student with no editable goal at all. Either
    // both land or neither does (§13). The in-memory adapter runs this
    // straight through; PostgreSQL commits it as one transaction.
    await store.transaction(async () => {
      await store.upsert(goal);
      await store.upsert(revision);
    });
    return { goal: cloneGoal(revision), validation };
  },

  /** Test seam: clears this engine's persisted goals. */
  async __reset(): Promise<void> {
    await store.clear();
  },
  };
}

export type GoalEngine = ReturnType<typeof createGoalEngine>;

/* ------------------------------------------------------------------ */

function applyPatch(goal: LearningGoal, patch: GoalRefinePatch): void {
  if (patch.desiredOutcome !== undefined) goal.desiredOutcome = patch.desiredOutcome.trim();
  if (patch.targetDomain !== undefined) goal.targetDomain = patch.targetDomain;
  if (patch.motivation !== undefined) goal.motivation = patch.motivation;
  if (patch.currentLevel !== undefined) goal.currentLevel = patch.currentLevel;
  if (patch.targetLevel !== undefined) goal.targetLevel = patch.targetLevel;
  if (patch.timeframe !== undefined) goal.timeframe = patch.timeframe;
  if (patch.weeklyCommitment !== undefined) goal.weeklyCommitment = patch.weeklyCommitment;
  if (patch.constraints !== undefined) goal.constraints = patch.constraints;
  if (patch.successCriteria !== undefined) {
    goal.successCriteria = patch.successCriteria.map((c) => c.trim()).filter((c) => c.length > 0);
  }
}

function cloneGoal(goal: LearningGoal): LearningGoal {
  return JSON.parse(JSON.stringify(goal)) as LearningGoal;
}
