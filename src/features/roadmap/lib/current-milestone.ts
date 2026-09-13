/**
 * The one current milestone (§23) — a pure derivation from domain state,
 * never from local UI state: the first in_progress, else the first
 * pending, in roadmap order. Multiple contradictory "currents" are
 * impossible by construction.
 */

import type { Milestone, Roadmap } from "@/types/roadmap";

export function currentMilestone(roadmap: Roadmap): Milestone | null {
  const ordered = [...roadmap.milestones].sort((a, b) => a.order - b.order);
  return (
    ordered.find((milestone) => milestone.status === "in_progress") ??
    ordered.find((milestone) => milestone.status === "pending") ??
    null
  );
}
