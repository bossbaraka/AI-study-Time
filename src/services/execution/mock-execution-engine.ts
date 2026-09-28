/**
 * Execution Engine (Phase 7) — runtime state over the Stage 6 plan.
 *
 * Isolated from React, storage and transport, and independently testable.
 * Execution records go through the injected `ExecutionStore` port and the
 * active roadmap through the `RoadmapLookup` port, so this module imports
 * no other engine. A future real backend swaps the adapters only, behind
 * the identical `execution.service.ts` contract.
 *
 * Ownership & trust (§6/§18): the student is always the session student;
 * the roadmap is always resolved through the `RoadmapLookup` port (Stage 6
 * ownership discipline) — client input carries a unitId only, and an
 * unknown unit is indistinguishable from a foreign one (404, no leaks).
 *
 * The curriculum is READ-ONLY here: milestone/roadmap statuses are never
 * mutated by execution (§14).
 */

import {
  EvidenceInvalidError,
  ExecutionConflictError,
  ExecutionNotFoundError,
  LearningUnitUnavailableError,
} from "@/services/execution/execution-errors";
import {
  deriveUnitStates,
  isAllUnitsPassed,
  isUnitStartable,
  nextUnitAfter,
  orderedUnits,
  selectCurrentUnit,
  toUnitRef,
  type OrderedUnit,
} from "@/services/execution/execution-projection";
import {
  assertTransition,
  InvalidExecutionTransitionError,
} from "@/services/execution/execution-state-machine";
import { developmentEvaluator } from "@/services/execution/development-evaluator";
import type { RoadmapLookup } from "@/services/ports/lookups";
import type { ExecutionStore } from "@/services/ports/stores";
import type {
  EvidenceInput,
  LearningUnitExecution,
  RoadmapExecutionView,
  UnitLearningContext,
} from "@/types/execution";
import type { Roadmap } from "@/types/roadmap";

function cloneExecution(execution: LearningUnitExecution): LearningUnitExecution {
  return JSON.parse(JSON.stringify(execution)) as LearningUnitExecution;
}

function nowIso(): string {
  return new Date().toISOString();
}

function newExecutionId(): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `ex_${random}`;
}

/* ------------------------------------------------------------------ */
/* Resolution helpers (session student → roadmap → unit)               */
/* ------------------------------------------------------------------ */

function resolveUnit(roadmap: Roadmap, learningUnitId: string): OrderedUnit {
  for (const entry of orderedUnits(roadmap)) {
    if (entry.unit.id === learningUnitId) return entry;
  }
  // Unknown and foreign unit ids must be indistinguishable (§6).
  throw new ExecutionNotFoundError();
}

export interface ExecutionEngineDeps {
  executions: ExecutionStore;
  /** Read side of the roadmap domain — breaks the engine→engine import. */
  roadmaps: RoadmapLookup;
}

export function createExecutionEngine(deps: ExecutionEngineDeps) {
  const store = deps.executions;
  const roadmaps = deps.roadmaps;

  function activeRoadmapFor(studentId: string): Roadmap {
    const roadmap = roadmaps.getActiveRoadmap(studentId);
    if (!roadmap) throw new LearningUnitUnavailableError("no_active_roadmap");
    return roadmap;
  }

  function executableRoadmapFor(studentId: string): Roadmap {
    const roadmap = activeRoadmapFor(studentId);
    if (roadmap.status !== "active") {
      throw new LearningUnitUnavailableError("roadmap_not_executable");
    }
    return roadmap;
  }

  function executionsForRoadmap(roadmapId: string): LearningUnitExecution[] {
    return store.listByRoadmap(roadmapId);
  }

  function findExecution(
    executions: readonly LearningUnitExecution[],
    learningUnitId: string,
  ): LearningUnitExecution | undefined {
    return executions.find((execution) => execution.learningUnitId === learningUnitId);
  }

  return {
  /**
   * Runtime view over the student's active roadmap — null when there is
   * no roadmap at all (the UI then belongs on /roadmap or /goals).
   */
  getExecutionView(studentId: string): RoadmapExecutionView | null {
    const roadmap = roadmaps.getActiveRoadmap(studentId);
    if (!roadmap) return null;
    const executions = executionsForRoadmap(roadmap.id);
    const current = selectCurrentUnit(roadmap, executions);
    return {
      roadmapId: roadmap.id,
      roadmapStatus: roadmap.status,
      unitStates: deriveUnitStates(roadmap, executions),
      currentUnit: current ? toUnitRef(current) : null,
      allUnitsPassed: isAllUnitsPassed(roadmap, executions),
    };
  },

  /** Full learn-screen context for one unit, resolved server-side. */
  getUnitContext(learningUnitId: string, studentId: string): UnitLearningContext {
    const roadmap = activeRoadmapFor(studentId);
    const { milestone, unit } = resolveUnit(roadmap, learningUnitId);
    const executions = executionsForRoadmap(roadmap.id);
    const execution = findExecution(executions, learningUnitId) ?? null;
    const states = deriveUnitStates(roadmap, executions);
    const next = nextUnitAfter(roadmap, executions, learningUnitId);
    return {
      roadmap: { id: roadmap.id, title: roadmap.title, status: roadmap.status },
      milestone: {
        id: milestone.id,
        title: milestone.title,
        order: milestone.order,
        learningOutcome: milestone.learningOutcome,
      },
      unit,
      execution: execution ? cloneExecution(execution) : null,
      // deriveUnitStates covers every unit; "blocked" is the safe default.
      status: states[unit.id] ?? "blocked",
      nextUnit: next ? toUnitRef(next) : null,
      allUnitsPassed: isAllUnitsPassed(roadmap, executions),
    };
  },

  /** The raw execution record for a unit (null when never started). */
  getExecutionState(learningUnitId: string, studentId: string): LearningUnitExecution | null {
    const roadmap = activeRoadmapFor(studentId);
    resolveUnit(roadmap, learningUnitId);
    const execution = findExecution(executionsForRoadmap(roadmap.id), learningUnitId);
    return execution ? cloneExecution(execution) : null;
  },

  /**
   * Starts (or resumes) a unit. Idempotent: repeated starts return the
   * SAME record — never duplicates (§16). Also serves as the explicit
   * retry edge after needs_review / failed (state machine guards it;
   * passed executions can never reopen).
   */
  startLearningUnit(learningUnitId: string, studentId: string): LearningUnitExecution {
    const roadmap = executableRoadmapFor(studentId);
    const { milestone, unit } = resolveUnit(roadmap, learningUnitId);
    const existing = findExecution(executionsForRoadmap(roadmap.id), unit.id);

    if (existing) {
      if (existing.status === "in_progress") {
        // Idempotent replay — safe under double clicks / concurrent calls.
        return cloneExecution(existing);
      }
      // evaluated+needs_review/failed → in_progress (retry);
      // submitted or evaluated+passed → InvalidExecutionTransitionError.
      assertTransition(existing, "in_progress");
      existing.status = "in_progress";
      store.upsert(existing);
      return cloneExecution(existing);
    }

    // Dependency gate (§6.5): blocked units cannot start.
    if (!isUnitStartable(roadmap, executionsForRoadmap(roadmap.id), unit.id)) {
      throw new LearningUnitUnavailableError("dependencies_unsatisfied");
    }

    const execution: LearningUnitExecution = {
      id: newExecutionId(),
      studentId,
      roadmapId: roadmap.id,
      milestoneId: milestone.id,
      learningUnitId: unit.id,
      status: "in_progress",
      startedAt: nowIso(),
    };
    store.upsert(execution);
    return cloneExecution(execution);
  },

  /**
   * Submits evidence for an in-progress unit. Empty evidence is rejected
   * (EvidenceInvalid); re-submitting identical evidence is a safe replay;
   * submitting different evidence over a submitted/evaluated record is a
   * conflict — the honest path is retry-then-resubmit (§16).
   */
  submitEvidence(
    learningUnitId: string,
    input: EvidenceInput,
    studentId: string,
  ): LearningUnitExecution {
    const roadmap = executableRoadmapFor(studentId);
    resolveUnit(roadmap, learningUnitId);
    const existing = findExecution(executionsForRoadmap(roadmap.id), learningUnitId);
    if (!existing) {
      // Never started: available → submitted is not a legal transition.
      throw new InvalidExecutionTransitionError("available", "submitted");
    }
    const execution = existing;

    const solution = input.solution.trim();
    const reasoning = input.reasoning.trim();
    if (!solution && !reasoning) {
      throw new EvidenceInvalidError();
    }

    if (execution.status === "submitted" || execution.status === "evaluated") {
      const identical =
        execution.evidence?.solution === solution &&
        execution.evidence?.reasoning === reasoning;
      if (identical) return cloneExecution(execution); // safe replay
      throw new ExecutionConflictError();
    }

    assertTransition(execution, "submitted");
    const submittedAt = nowIso();
    execution.evidence = { kind: "text", solution, reasoning, submittedAt };
    execution.submittedAt = submittedAt;
    execution.status = "submitted";
    store.upsert(execution);
    return cloneExecution(execution);
  },

  /**
   * Evaluates submitted evidence with the development evaluator (§9).
   * Deterministic: replaying evaluation of the same evidence returns the
   * same result without corrupting state (§16).
   */
  evaluateExecution(learningUnitId: string, studentId: string): LearningUnitExecution {
    const roadmap = executableRoadmapFor(studentId);
    resolveUnit(roadmap, learningUnitId);
    const existing = findExecution(executionsForRoadmap(roadmap.id), learningUnitId);
    if (!existing) {
      // Nothing submitted: available → evaluated is not a legal transition.
      throw new InvalidExecutionTransitionError("available", "evaluated");
    }
    const execution = existing;

    if (execution.status === "evaluated") {
      // Idempotent replay — the evaluator is deterministic anyway.
      return cloneExecution(execution);
    }
    assertTransition(execution, "evaluated");
    if (!execution.evidence) {
      // Unreachable through the legal path; never evaluate without evidence.
      throw new EvidenceInvalidError();
    }

    execution.result = developmentEvaluator.evaluate(execution.evidence);
    execution.evaluatedAt = nowIso();
    execution.status = "evaluated";
    store.upsert(execution);
    return cloneExecution(execution);
  },

  /** Test seam: clears this engine's persisted executions. */
  __reset(): void {
    store.clear();
  },
  };
}

export type ExecutionEngine = ReturnType<typeof createExecutionEngine>;
