/**
 * Pure execution projections (Phase 7, §12/§13).
 *
 * Derives runtime state from the Stage 6 Roadmap contract + execution
 * records. NO new curriculum algorithm: dependency truth comes from
 * `milestone.dependencies` (the roadmap's own prerequisite graph) and
 * unit order within a milestone. No React, no storage — independently
 * testable, deterministic.
 *
 * Rules:
 * - A milestone is satisfied when ALL of its learning units have a
 *   passed execution. (Checkpoint execution is a future stage — this is
 *   documented, never faked.)
 * - A unit is available when its milestone's dependencies are satisfied
 *   AND every earlier unit in the same milestone has passed.
 * - The current unit is the FIRST non-passed, non-blocked unit in
 *   roadmap order — in-flight and needs_review/failed units "remain
 *   relevant" (§10), so exactly one unit ever owns the student's focus.
 */

import type {
  DerivedUnitStatus,
  LearningUnitExecution,
  UnitRef,
} from "@/types/execution";
import type { LearningUnit, Milestone, Roadmap } from "@/types/roadmap";

export interface OrderedUnit {
  milestone: Milestone;
  unit: LearningUnit;
}

/** Every unit in roadmap order: milestone order first, unit order inside. */
export function orderedUnits(roadmap: Roadmap): OrderedUnit[] {
  return [...roadmap.milestones]
    .sort((a, b) => a.order - b.order)
    .flatMap((milestone) =>
      [...milestone.learningUnits]
        .sort((a, b) => a.order - b.order)
        .map((unit) => ({ milestone, unit })),
    );
}

export function executionsByUnit(
  executions: readonly LearningUnitExecution[],
): Map<string, LearningUnitExecution> {
  return new Map(executions.map((execution) => [execution.learningUnitId, execution]));
}

/** Unit ids with a passed execution — the only currency that unlocks. */
export function passedUnitIds(
  executions: readonly LearningUnitExecution[],
): Set<string> {
  return new Set(
    executions
      .filter((execution) => execution.status === "evaluated" && execution.result === "passed")
      .map((execution) => execution.learningUnitId),
  );
}

/** A milestone is satisfied when all of its units have passed. */
export function isMilestoneSatisfied(
  milestone: Milestone,
  passed: ReadonlySet<string>,
): boolean {
  return milestone.learningUnits.every((unit) => passed.has(unit.id));
}

/** All prerequisite milestones satisfied (the roadmap's own dep graph). */
export function areDependenciesSatisfied(
  milestone: Milestone,
  roadmap: Roadmap,
  passed: ReadonlySet<string>,
): boolean {
  return milestone.dependencies.every((dependencyId) => {
    const dependency = roadmap.milestones.find((entry) => entry.id === dependencyId);
    // Generation-time validation guarantees dependencies exist; a dangling
    // id is treated as satisfied rather than blocking the student forever.
    return dependency ? isMilestoneSatisfied(dependency, passed) : true;
  });
}

/** True when every earlier unit in the same milestone has passed. */
function earlierUnitsPassed(
  milestone: Milestone,
  unit: LearningUnit,
  passed: ReadonlySet<string>,
): boolean {
  return milestone.learningUnits
    .filter((entry) => entry.order < unit.order)
    .every((entry) => passed.has(entry.id));
}

/**
 * The honest per-unit state (§13): the execution record when one exists,
 * otherwise available/blocked from the dependency graph. Never a
 * percentage, never invented precision.
 */
export function deriveUnitStatus(
  milestone: Milestone,
  unit: LearningUnit,
  roadmap: Roadmap,
  passed: ReadonlySet<string>,
  execution: LearningUnitExecution | undefined,
): DerivedUnitStatus {
  if (execution) {
    switch (execution.status) {
      case "in_progress":
        return "in_progress";
      case "submitted":
        return "submitted";
      case "evaluated":
        if (execution.result === "passed") return "passed";
        if (execution.result === "failed") return "failed";
        // needs_review — and (defensively) evaluated without a result:
        // insufficient evidence keeps the unit relevant, never advances.
        return "needs_review";
      case "available":
        return "available";
    }
  }
  const unlocked =
    areDependenciesSatisfied(milestone, roadmap, passed) &&
    earlierUnitsPassed(milestone, unit, passed);
  return unlocked ? "available" : "blocked";
}

/** Derived status for every unit in the roadmap. */
export function deriveUnitStates(
  roadmap: Roadmap,
  executions: readonly LearningUnitExecution[],
): Record<string, DerivedUnitStatus> {
  const passed = passedUnitIds(executions);
  const byUnit = executionsByUnit(executions);
  const states: Record<string, DerivedUnitStatus> = {};
  for (const { milestone, unit } of orderedUnits(roadmap)) {
    states[unit.id] = deriveUnitStatus(milestone, unit, roadmap, passed, byUnit.get(unit.id));
  }
  return states;
}

/**
 * The ONE current unit: first in roadmap order that is neither passed
 * nor blocked. Null when every unit has passed (milestone/roadmap
 * completion semantics are NOT decided here — §12).
 */
export function selectCurrentUnit(
  roadmap: Roadmap,
  executions: readonly LearningUnitExecution[],
): OrderedUnit | null {
  const passed = passedUnitIds(executions);
  const byUnit = executionsByUnit(executions);
  for (const { milestone, unit } of orderedUnits(roadmap)) {
    const status = deriveUnitStatus(milestone, unit, roadmap, passed, byUnit.get(unit.id));
    if (status !== "passed" && status !== "blocked") return { milestone, unit };
  }
  return null;
}

/**
 * The unit that opens up once `unitId` passes — the honest "what happens
 * next". Computed by projecting the pass, never by mutating anything.
 */
export function nextUnitAfter(
  roadmap: Roadmap,
  executions: readonly LearningUnitExecution[],
  unitId: string,
): OrderedUnit | null {
  const passed = passedUnitIds(executions);
  passed.add(unitId);
  const byUnit = executionsByUnit(executions);
  for (const { milestone, unit } of orderedUnits(roadmap)) {
    if (unit.id === unitId) continue;
    const status = deriveUnitStatus(milestone, unit, roadmap, passed, byUnit.get(unit.id));
    if (status !== "passed" && status !== "blocked") return { milestone, unit };
  }
  return null;
}

export function isAllUnitsPassed(
  roadmap: Roadmap,
  executions: readonly LearningUnitExecution[],
): boolean {
  const states = deriveUnitStates(roadmap, executions);
  return orderedUnits(roadmap).every(({ unit }) => states[unit.id] === "passed");
}

/** True when the unit can be started right now (dependency gate, §6.5). */
export function isUnitStartable(
  roadmap: Roadmap,
  executions: readonly LearningUnitExecution[],
  unitId: string,
): boolean {
  const passed = passedUnitIds(executions);
  const byUnit = executionsByUnit(executions);
  for (const { milestone, unit } of orderedUnits(roadmap)) {
    if (unit.id !== unitId) continue;
    return (
      deriveUnitStatus(milestone, unit, roadmap, passed, byUnit.get(unit.id)) === "available"
    );
  }
  return false;
}

export function toUnitRef(entry: OrderedUnit): UnitRef {
  return {
    id: entry.unit.id,
    title: entry.unit.title,
    milestoneId: entry.milestone.id,
    milestoneTitle: entry.milestone.title,
  };
}
