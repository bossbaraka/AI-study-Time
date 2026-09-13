/**
 * Roadmap state machine (§8) — the only authority on roadmap status.
 *
 *   draft → active → completed
 *   active ⇄ paused
 *   active → revised → (new roadmap draft)
 *
 * COMPLETED → ACTIVE, ABANDONED → ACTIVE and REVISED → ACTIVE can never
 * happen implicitly; every edge is explicit and tested.
 */

import type { RoadmapStatus } from "@/types/roadmap";

const TRANSITIONS: Readonly<Record<RoadmapStatus, readonly RoadmapStatus[]>> = {
  draft: ["active", "abandoned"],
  active: ["paused", "completed", "revised", "abandoned"],
  paused: ["active", "abandoned"],
  // Terminal: a revised roadmap is history — a NEW roadmap carries on.
  revised: [],
  completed: [],
  abandoned: [],
};

export class InvalidRoadmapTransitionError extends Error {
  constructor(
    readonly from: RoadmapStatus,
    readonly to: RoadmapStatus,
  ) {
    super(`Invalid roadmap transition: ${from} → ${to}`);
    this.name = "InvalidRoadmapTransitionError";
  }
}

export function canTransition(from: RoadmapStatus, to: RoadmapStatus): boolean {
  if (from === to) return false; // no-op "transitions" are not transitions
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: RoadmapStatus, to: RoadmapStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidRoadmapTransitionError(from, to);
  }
}

export function isTerminal(status: RoadmapStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
