/**
 * Deterministic Roadmap Engine (§4/§17) — the mock-phase planner.
 *
 * Isolated from React and independently testable, exactly like the auth,
 * assessment and goal engines. A future AIRoadmapPlanner replaces this
 * module behind the identical `roadmap.service.ts` contract without any
 * UI change.
 *
 * Pipeline (all steps deterministic — same LockedGoal + diagnosis ⇒
 * same roadmap for the same engine version):
 *   1  Validate the locked goal
 *   2  Extract diagnosis (from the goal's own snapshot)
 *   3  Determine starting level & target capability depth
 *   4  Select capabilities (domain + target level + prerequisite closure)
 *   5  Diagnosis-aware prioritisation (attention up, strengths maintained)
 *   6  Topological ordering (cycle-hostile)
 *   7  Time budgeting against timeframe × weekly commitment
 *   8  Milestone / learning-unit / checkpoint generation
 *   9  Quality validation gate — never returns a partially valid roadmap
 *  10  Persist (draft → active through the state machine)
 */

import { ApiError } from "@/lib/api/client";
import { mockGoalEngine } from "@/services/goals/mock-goal-engine";
import {
  ALLOCATION_POLICY,
  buildCustomCapabilities,
  capabilitiesForDomain,
  domainLabelEN,
  type CapabilityTemplate,
  type UnitSlot,
} from "@/services/roadmap/curriculum";
import { DependencyCycleError, hasCycle, topologicalSort, type GraphEdge } from "@/services/roadmap/graph";
import { assertTransition } from "@/services/roadmap/roadmap-state-machine";
import {
  RoadmapGenerationError,
  RoadmapOwnershipError,
  RoadmapValidationError,
} from "@/services/roadmap/roadmap-errors";
import { CURRENT_LEVELS, TARGET_LEVELS, type LearningGoal } from "@/types/goal";
import type {
  Checkpoint,
  CheckpointType,
  LearningUnit,
  LearningUnitType,
  Milestone,
  Roadmap,
  RoadmapGenerationResult,
  TimeFeasibility,
} from "@/types/roadmap";

export const ENGINE_VERSION = "roadmap-engine/1.0.0";

const STORAGE_KEY = "mureeh.mock.roadmaps.v1";

/**
 * Starting-level → position on the 0–5 target scale (roadmap policy,
 * mirrors the Phase 5 heuristic so both engines speak one scale).
 */
const START_SCALE: Record<(typeof CURRENT_LEVELS)[number], number> = {
  new_to_it: 0,
  basic_familiarity: 0,
  developing: 1,
  comfortable: 2,
  advanced: 3,
};

const CURRENT_LEVEL_PHRASES_EN: Record<(typeof CURRENT_LEVELS)[number], string> = {
  new_to_it: "starting fresh",
  basic_familiarity: "basic familiarity",
  developing: "a developing base",
  comfortable: "solid comfort",
  advanced: "an advanced base",
};

const TARGET_LEVEL_PHRASES_EN: Record<(typeof TARGET_LEVELS)[number], string> = {
  understand_fundamentals: "understanding the fundamentals",
  build_independently: "building independently",
  build_production_quality: "building production-quality work",
  work_professionally: "working professionally",
  teach_explain: "teaching and explaining",
  master_advanced: "mastering advanced topics",
};

/* ------------------------------------------------------------------ */
/* Persistence (mirrors the goal-engine mock pattern)                  */
/* ------------------------------------------------------------------ */

let memoryStore: Roadmap[] = [];

function loadRoadmaps(): Roadmap[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return memoryStore;
    const parsed = JSON.parse(raw) as Roadmap[];
    if (!Array.isArray(parsed)) return memoryStore;
    memoryStore = parsed;
    return memoryStore;
  } catch {
    return memoryStore;
  }
}

function saveRoadmaps(roadmaps: Roadmap[]): void {
  memoryStore = roadmaps;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(roadmaps));
  } catch {
    // Storage unavailable: memory-only is acceptable for the mock phase.
  }
}

function cloneRoadmap(roadmap: Roadmap): Roadmap {
  return JSON.parse(JSON.stringify(roadmap)) as Roadmap;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newRoadmapId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `rm_${random}`;
}

function ownRoadmap(roadmaps: Roadmap[], roadmapId: string, studentId: string): Roadmap {
  const roadmap = roadmaps.find((entry) => entry.id === roadmapId);
  // Same discipline as the goal engine: existence is never leaked across
  // students — a foreign id is indistinguishable from a missing one.
  if (!roadmap || roadmap.studentId !== studentId) {
    throw new RoadmapOwnershipError(404, "roadmap_not_found");
  }
  return roadmap;
}

/* ------------------------------------------------------------------ */
/* Unit & checkpoint content templates (English mock content)          */
/* ------------------------------------------------------------------ */

function unitTemplate(
  type: LearningUnitType,
  cap: CapabilityTemplate,
): Pick<LearningUnit, "title" | "purpose" | "expectedOutcome" | "completionEvidence"> {
  const subject = cap.title.toLowerCase();
  switch (type) {
    case "learn":
      return {
        title: `Study: ${cap.title}`,
        purpose: cap.description,
        expectedOutcome: `Understand the key ideas of ${subject} well enough to explain them.`,
        completionEvidence: "Explain the main ideas without looking at notes.",
      };
    case "practice":
      return {
        title: `Practice: ${cap.title}`,
        purpose: `${cap.description} Practice converts understanding into reliability.`,
        expectedOutcome: cap.learningOutcome,
        completionEvidence: "Complete practice problems without following a tutorial.",
      };
    case "build":
      return {
        title: `Build with: ${cap.title}`,
        purpose: `Apply ${subject} in a small, real artefact.`,
        expectedOutcome: cap.learningOutcome,
        completionEvidence: "A working artefact you can show and re-run.",
      };
    case "review":
      return {
        title: `Review: ${cap.title}`,
        purpose: `Revisit ${subject} to close any lingering gaps — strengths stay strong through use.`,
        expectedOutcome: `Re-confirm ${subject} under new, unfamiliar prompts.`,
        completionEvidence: "A short list of what is solid and what needs another pass.",
      };
    case "reflect":
      return {
        title: `Reflect: ${cap.title}`,
        purpose: `Consolidate what changed in your understanding of ${subject}.`,
        expectedOutcome: `Articulate how your thinking about ${subject} developed.`,
        completionEvidence: "A written reflection: what clicked, what is still fuzzy.",
      };
    case "assess":
      return {
        title: `Self-check: ${cap.title}`,
        purpose: `Verify readiness before moving on — honest evidence, not vibes.`,
        expectedOutcome: `Demonstrate ${subject} under check conditions.`,
        completionEvidence: "Pass your own short diagnostic on this capability.",
      };
  }
}

function checkpointTemplate(
  type: CheckpointType,
  cap: CapabilityTemplate,
): Pick<Checkpoint, "title" | "description" | "successSignal"> {
  const subject = cap.title.toLowerCase();
  switch (type) {
    case "explain":
      return {
        title: `Explain ${subject}`,
        description: `Explain the core ideas of ${subject} in your own words, out loud or in writing.`,
        successSignal: "Someone else can follow your explanation without extra context.",
      };
    case "solve_new_problem":
      return {
        title: "Solve an unfamiliar problem",
        description: `Solve a new ${subject} problem you have never seen, without a tutorial.`,
        successSignal: "You reach a correct solution and can explain each step.",
      };
    case "build_feature":
      return {
        title: "Build a small feature",
        description: `Independently build a small feature that uses ${subject}.`,
        successSignal: "It works — and you built it without step-by-step instructions.",
      };
    case "debug_unfamiliar":
      return {
        title: "Debug unfamiliar code",
        description: `Find and fix seeded bugs in code using ${subject} that you did not write.`,
        successSignal: "You can say why each bug happened, not just where it was.",
      };
    case "diagnostic_quiz":
      return {
        title: "Short diagnostic check",
        description: `Pass a short diagnostic on ${subject}.`,
        successSignal: "Core questions answered correctly — and you know why the wrong options are wrong.",
      };
    case "practical_project":
      return {
        title: "Practical project",
        description: `Complete a practical project that uses this milestone's capability end to end.`,
        successSignal: "The project runs and demonstrably meets its stated outcome.",
      };
  }
}

/* ------------------------------------------------------------------ */
/* Selection & prioritisation (steps 2–6)                              */
/* ------------------------------------------------------------------ */

interface PlannedCapability {
  template: CapabilityTemplate;
  hours: number;
  /** Attention areas first inside the same depth — diagnosis prioritizes. */
  priority: number;
  /** True when this capability mainly preserves an assessed strength. */
  maintenance: boolean;
}

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function roundHalf(value: number): number {
  return Math.max(0.5, Math.round(value * 2) / 2);
}

function capabilitiesFor(goal: LearningGoal): CapabilityTemplate[] {
  const domain = goal.targetDomain;
  if (domain.kind === "custom") {
    return buildCustomCapabilities(domain.label, goal.successCriteria);
  }
  return capabilitiesForDomain(domain.presetId);
}

/**
 * Selects the capabilities for this goal:
 * depth ≤ target index, plus the transitive prerequisite closure — a
 * capability never appears without what it depends on (§12).
 */
function selectCapabilities(goal: LearningGoal): CapabilityTemplate[] {
  const all = capabilitiesFor(goal);
  if (all.length === 0) {
    throw new RoadmapGenerationError("generation_failed", "empty curriculum");
  }
  const byId = new Map(all.map((cap) => [cap.id, cap]));
  const targetIndex = TARGET_LEVELS.indexOf(goal.targetLevel);

  const selected = new Map<string, CapabilityTemplate>();
  const visit = (cap: CapabilityTemplate) => {
    if (selected.has(cap.id)) return;
    selected.set(cap.id, cap);
    for (const dependencyId of cap.dependsOn) {
      const dependency = byId.get(dependencyId);
      if (dependency) visit(dependency);
    }
  };
  for (const cap of all) {
    if (cap.depth <= targetIndex) visit(cap);
  }
  if (selected.size === 0) {
    throw new RoadmapGenerationError("generation_failed", "no capabilities match target level");
  }
  return all.filter((cap) => selected.has(cap.id));
}

/**
 * Diagnosis-aware planning (§13): preserve strengths (review-first,
 * compressed), reinforce developing areas, prioritize attention areas.
 * The diagnosis informs ordering and effort — it never overrides the
 * locked goal.
 */
function planCapabilities(goal: LearningGoal, selected: CapabilityTemplate[]): PlannedCapability[] {
  const diagnosis = goal.diagnosisContext;
  const gapTopics = new Set((diagnosis?.knowledgeGaps ?? []).map((entry) => entry.topic));
  const developingTopics = new Set((diagnosis?.developingAreas ?? []).map((entry) => entry.topic));
  const strengthTopics = new Set((diagnosis?.strengths ?? []).map((entry) => entry.topic));
  const factors = ALLOCATION_POLICY.diagnosis;
  // Starting level (§39): material below the student's assessed base is
  // maintained, not re-taught — unless the diagnosis flags it as weak.
  const startScale = START_SCALE[goal.currentLevel];

  return selected.map((template) => {
    const topics = template.assessmentTopics ?? [];
    const matches = (set: Set<string>) => topics.some((topic) => set.has(topic));

    const weak = matches(gapTopics);
    const developing = !weak && matches(developingTopics);
    const strong = !weak && !developing && matches(strengthTopics);
    const belowStart = !weak && !developing && !strong && template.depth < startScale;

    let hours = template.baseHours;
    if (weak) hours *= factors.knowledgeGapFactor;
    else if (developing) hours *= factors.developingFactor;
    else if (strong) hours *= factors.strengthFactor;
    else if (belowStart) hours *= factors.priorKnowledgeFactor;

    return {
      template,
      hours: roundHalf(hours),
      priority: weak ? 2 : developing ? 1 : 0,
      maintenance: strong || belowStart,
    };
  });
}

/** Deterministic order: prerequisite-safe, attention-first within depth. */
function orderCapabilities(planned: PlannedCapability[]): PlannedCapability[] {
  const preferred = [...planned].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    if (a.template.depth !== b.template.depth) return a.template.depth - b.template.depth;
    return planned.indexOf(a) - planned.indexOf(b); // declaration order
  });

  const nodes = preferred.map((entry) => entry.template.id);
  const edges: GraphEdge[] = [];
  for (const entry of preferred) {
    for (const dependency of entry.template.dependsOn) {
      if (nodes.includes(dependency)) {
        edges.push({ from: entry.template.id, to: dependency });
      }
    }
  }
  try {
    const order = topologicalSort(nodes, edges);
    const byId = new Map(preferred.map((entry) => [entry.template.id, entry]));
    return order.map((id) => byId.get(id)!);
  } catch (error) {
    if (error instanceof DependencyCycleError) {
      throw new RoadmapGenerationError("generation_failed", "dependency cycle in curriculum");
    }
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Time budgeting (step 7, §15)                                        */
/* ------------------------------------------------------------------ */

interface TimeBudget {
  availableHours: number;
  requiredHours: number;
  feasibility: TimeFeasibility;
  scale: number;
}

function planTimeBudget(goal: LearningGoal, ordered: PlannedCapability[]): TimeBudget {
  const availableHours = goal.timeframe.weeks * goal.weeklyCommitment.hoursPerWeek;
  const requiredHours = roundHalf(ordered.reduce((sum, entry) => sum + entry.hours, 0));
  const { tightRatio, minScale, minViableHours } = ALLOCATION_POLICY.feasibility;

  if (availableHours <= 0 || availableHours < minViableHours) {
    throw new RoadmapGenerationError("infeasible_timeframe");
  }

  let feasibility: TimeFeasibility = "fits";
  if (requiredHours > availableHours * tightRatio) feasibility = "exceeds";
  else if (requiredHours > availableHours) feasibility = "tight";

  let scale = 1;
  if (feasibility === "exceeds") {
    scale = availableHours / requiredHours;
    if (scale < minScale) {
      // Honest failure instead of a fantasy roadmap: the locked budget
      // cannot carry even a compressed version of this path.
      throw new RoadmapGenerationError("infeasible_timeframe");
    }
  }
  return { availableHours, requiredHours, feasibility, scale };
}

/* ------------------------------------------------------------------ */
/* Milestone generation (steps 8–11)                                   */
/* ------------------------------------------------------------------ */

function buildUnit(
  milestoneId: string,
  cap: CapabilityTemplate,
  slot: UnitSlot,
  index: number,
  hours: number,
): LearningUnit {
  const minutes = Math.max(15, Math.round((slot.share * hours * 60) / 5) * 5);
  const template = unitTemplate(slot.type, cap);
  return {
    id: `unit_${cap.id}_${slot.type}`,
    milestoneId,
    type: slot.type,
    order: index,
    estimatedMinutes: minutes,
    ...template,
  };
}

function buildMilestones(
  roadmapId: string,
  goal: LearningGoal,
  ordered: PlannedCapability[],
  scale: number,
): Milestone[] {
  const goalOutcome = truncate(goal.desiredOutcome, 90);
  const selectedIds = new Set(ordered.map((entry) => entry.template.id));

  return ordered.map((entry, index) => {
    const cap = entry.template;
    const milestoneId = `ms_${cap.id}`;
    const hours = roundHalf(entry.hours * scale);
    const split = entry.maintenance
      ? ALLOCATION_POLICY.maintenanceSplit
      : ALLOCATION_POLICY.unitSplit[cap.stage];

    const learningUnits = split.map((slot, slotIndex) =>
      buildUnit(milestoneId, cap, slot, slotIndex, hours),
    );

    return {
      id: milestoneId,
      roadmapId,
      capabilityId: cap.id,
      title: cap.title,
      description: cap.description,
      order: index,
      status: "pending" as const,
      learningOutcome: cap.learningOutcome,
      estimatedHours: hours,
      dependencies: cap.dependsOn
        .filter((dependency) => selectedIds.has(dependency))
        .map((dependency) => `ms_${dependency}`),
      learningUnits,
      checkpoint: {
        id: `cp_${cap.id}`,
        milestoneId,
        type: cap.checkpoint,
        ...checkpointTemplate(cap.checkpoint, cap),
      },
      goalAlignment: `Builds ${cap.title.toLowerCase()} — required for your locked outcome: “${goalOutcome}”.`,
      maintenance: entry.maintenance,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Quality gate (step 13, §18)                                         */
/* ------------------------------------------------------------------ */

export function validateRoadmapStructure(roadmap: Roadmap): void {
  const issues: string[] = [];

  if (roadmap.milestones.length === 0) issues.push("roadmap has no milestones");
  if (roadmap.version < 1) issues.push("roadmap version must be ≥ 1");
  if (roadmap.title.trim().length === 0) issues.push("roadmap title missing");
  if (roadmap.description.trim().length === 0) issues.push("roadmap description missing");

  const ids = new Set(roadmap.milestones.map((milestone) => milestone.id));
  const orderByid = new Map(roadmap.milestones.map((milestone) => [milestone.id, milestone.order]));

  for (const milestone of roadmap.milestones) {
    if (milestone.learningOutcome.trim().length === 0) {
      issues.push(`${milestone.id}: missing learning outcome`);
    }
    if (milestone.goalAlignment.trim().length === 0) {
      issues.push(`${milestone.id}: missing goal alignment`);
    }
    if (milestone.estimatedHours <= 0) {
      issues.push(`${milestone.id}: non-positive hours`);
    }
    if (!milestone.checkpoint) {
      issues.push(`${milestone.id}: missing checkpoint`);
    }
    if (milestone.learningUnits.length === 0) {
      issues.push(`${milestone.id}: no learning units`);
    }
    for (const unit of milestone.learningUnits) {
      if (unit.estimatedMinutes <= 0) issues.push(`${unit.id}: non-positive minutes`);
      if (unit.purpose.trim().length === 0) issues.push(`${unit.id}: missing purpose`);
      if (unit.completionEvidence.trim().length === 0) {
        issues.push(`${unit.id}: missing completion evidence`);
      }
    }
    for (const dependency of milestone.dependencies) {
      if (!ids.has(dependency)) {
        issues.push(`${milestone.id}: unknown dependency ${dependency}`);
      } else if ((orderByid.get(dependency) ?? 0) >= milestone.order) {
        issues.push(`${milestone.id}: dependency ${dependency} is not ordered before it`);
      }
    }
  }

  const edges: GraphEdge[] = [];
  for (const milestone of roadmap.milestones) {
    for (const dependency of milestone.dependencies) {
      edges.push({ from: milestone.id, to: dependency });
    }
  }
  if (hasCycle(roadmap.milestones.map((milestone) => milestone.id), edges)) {
    issues.push("milestone dependency cycle");
  }

  if (issues.length > 0) throw new RoadmapValidationError(issues);
}

/* ------------------------------------------------------------------ */
/* The engine                                                          */
/* ------------------------------------------------------------------ */

function generationKeyFor(studentId: string, goal: LearningGoal): string {
  return `${studentId}:${goal.id}:${goal.version}:${ENGINE_VERSION}`;
}

function loadLockedGoal(goalId: string, studentId: string): LearningGoal {
  let goal: LearningGoal;
  try {
    goal = mockGoalEngine.getGoal(goalId, studentId);
  } catch (error) {
    // The goal engine guards ownership with its own typed errors.
    if (error instanceof ApiError && error.code === "goal_not_found") {
      throw new RoadmapGenerationError("no_locked_goal");
    }
    throw error;
  }
  if (goal.status !== "locked") {
    throw new RoadmapGenerationError("no_locked_goal");
  }
  return goal;
}

export const mockRoadmapEngine = {
  /**
   * Generates (or replays) the roadmap for a locked goal.
   * Idempotent on studentId + goalId + goalVersion + engineVersion (§19).
   */
  generateRoadmap(goalId: string, studentId: string): RoadmapGenerationResult {
    const roadmaps = loadRoadmaps();
    const goal = loadLockedGoal(goalId, studentId);
    const generationKey = generationKeyFor(studentId, goal);

    // Idempotent replay: identical request → identical roadmap, no duplicate.
    const existing = roadmaps.find(
      (entry) =>
        entry.studentId === studentId && entry.generationContext.generationKey === generationKey,
    );
    if (existing) {
      return { roadmap: cloneRoadmap(existing), created: false };
    }

    // A goal revision supersedes the previous roadmap — history is kept,
    // never mutated in place (§20). Versions increase monotonically per
    // student: 1 + the highest version ever generated.
    let version = 1;
    for (const entry of roadmaps) {
      if (entry.studentId !== studentId) continue;
      version = Math.max(version, entry.version + 1);
      if (["draft", "active", "paused"].includes(entry.status)) {
        assertTransition(entry.status, "revised");
        entry.status = "revised";
        entry.updatedAt = nowIso();
      }
    }

    const selected = selectCapabilities(goal);
    const planned = planCapabilities(goal, selected);
    const ordered = orderCapabilities(planned);
    const budget = planTimeBudget(goal, ordered);

    const roadmapId = newRoadmapId();
    const label = domainLabelEN(goal.targetDomain);
    const milestones = buildMilestones(roadmapId, goal, ordered, budget.scale);

    const weeks = goal.timeframe.weeks;
    const roadmap: Roadmap = {
      id: roadmapId,
      studentId,
      goalId: goal.id,
      version,
      status: "draft",
      title: `Your ${label} path: ${truncate(goal.desiredOutcome, 60)}`,
      description:
        `A ${milestones.length}-milestone strategy from ${CURRENT_LEVEL_PHRASES_EN[goal.currentLevel]} ` +
        `to ${TARGET_LEVEL_PHRASES_EN[goal.targetLevel]}, fitted to ${goal.weeklyCommitment.hoursPerWeek} ` +
        `hours per week over ${weeks} weeks.`,
      estimatedDuration:
        weeks % 4 === 0 ? { value: weeks / 4, unit: "months" } : { value: weeks, unit: "weeks" },
      weeklyCommitment: goal.weeklyCommitment.hoursPerWeek,
      totalEstimatedHours: roundHalf(milestones.reduce((sum, ms) => sum + ms.estimatedHours, 0)),
      timeFeasibility: budget.feasibility,
      milestones,
      generationContext: {
        goalVersion: goal.version,
        engineVersion: ENGINE_VERSION,
        ...(goal.diagnosisContext
          ? { diagnosisSessionId: goal.diagnosisContext.sessionId }
          : {}),
        generationKey,
        availableHours: roundHalf(budget.availableHours),
        requiredHours: budget.requiredHours,
      },
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    // §18: validate BEFORE the roadmap is ever exposed or persisted.
    validateRoadmapStructure(roadmap);

    // Publish: draft → active, first milestone becomes the current one (§23).
    assertTransition(roadmap.status, "active");
    roadmap.status = "active";
    const first = roadmap.milestones[0];
    if (first) first.status = "in_progress";

    roadmaps.push(roadmap);
    saveRoadmaps(roadmaps);
    return { roadmap: cloneRoadmap(roadmap), created: true };
  },

  /** The student's live roadmap (draft/active/paused), newest first. */
  getActiveRoadmap(studentId: string): Roadmap | null {
    const roadmaps = loadRoadmaps();
    let active: Roadmap | undefined;
    for (const roadmap of roadmaps) {
      if (roadmap.studentId !== studentId) continue;
      if (!["draft", "active", "paused"].includes(roadmap.status)) continue;
      if (!active || roadmap.createdAt >= active.createdAt) active = roadmap;
    }
    return active ? cloneRoadmap(active) : null;
  },

  getRoadmap(roadmapId: string, studentId: string): Roadmap {
    const roadmaps = loadRoadmaps();
    return cloneRoadmap(ownRoadmap(roadmaps, roadmapId, studentId));
  },

  pauseRoadmap(roadmapId: string, studentId: string): Roadmap {
    const roadmaps = loadRoadmaps();
    const roadmap = ownRoadmap(roadmaps, roadmapId, studentId);
    assertTransition(roadmap.status, "paused");
    roadmap.status = "paused";
    roadmap.updatedAt = nowIso();
    saveRoadmaps(roadmaps);
    return cloneRoadmap(roadmap);
  },

  resumeRoadmap(roadmapId: string, studentId: string): Roadmap {
    const roadmaps = loadRoadmaps();
    const roadmap = ownRoadmap(roadmaps, roadmapId, studentId);
    assertTransition(roadmap.status, "active");
    roadmap.status = "active";
    roadmap.updatedAt = nowIso();
    saveRoadmaps(roadmaps);
    return cloneRoadmap(roadmap);
  },

  /** Test helper: clears persisted mock state. */
  __reset(): void {
    memoryStore = [];
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore unavailable storage in non-browser contexts.
    }
  },
};
