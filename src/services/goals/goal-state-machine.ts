/**
 * Goal state machine — the ONLY authority on status transitions.
 *
 * Pure module: no React, no storage, no network. Components can never
 * mutate `goal.status` directly; every change passes through
 * `assertTransition` inside the engine/service layer.
 *
 * Phase 5 primarily exercises:
 *   draft → discovered → refining → validated → locked
 * Later phases own: locked → active → achieved (+ paused / abandoned /
 * revised). The edges exist so the machine is complete, not speculative:
 * each one is enforced and tested here.
 */

import type { GoalStatus } from "@/types/goal";

/** Allowed edges. Anything absent is rejected. */
const TRANSITIONS: Readonly<Record<GoalStatus, readonly GoalStatus[]>> = {
  draft: ["discovered", "abandoned"],
  // Discovery captured; validation either challenges it or accepts it.
  discovered: ["refining", "validated", "abandoned"],
  // Refinement loops until the goal validates.
  refining: ["refining", "validated", "abandoned"],
  // A validated goal can still be edited (back to refining) or locked.
  validated: ["refining", "locked", "abandoned"],
  // Locked is committed: only an explicit revision or Phase 6 activation.
  locked: ["active", "revised"],
  active: ["achieved", "paused", "revised"],
  paused: ["active", "abandoned"],
  achieved: [],
  abandoned: [],
  revised: [],
};

export class InvalidGoalTransitionError extends Error {
  constructor(
    readonly from: GoalStatus,
    readonly to: GoalStatus,
  ) {
    super(`Invalid goal transition: ${from} → ${to}`);
    this.name = "InvalidGoalTransitionError";
  }
}

export function canTransition(from: GoalStatus, to: GoalStatus): boolean {
  if (from === to) return false; // No-op "transitions" are not transitions.
  return TRANSITIONS[from].includes(to);
}

/** Throws `InvalidGoalTransitionError` when the edge is not allowed. */
export function assertTransition(from: GoalStatus, to: GoalStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidGoalTransitionError(from, to);
  }
}

/** True for statuses where the goal content can still change. */
export function isEditable(status: GoalStatus): boolean {
  return status === "draft" || status === "discovered" || status === "refining" || status === "validated";
}

/** True for terminal statuses — no outgoing edges at all. */
export function isTerminal(status: GoalStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
