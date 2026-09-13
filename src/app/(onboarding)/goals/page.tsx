"use client";

import { GoalDiscoveryFlow } from "@/features/goals/components/goal-discovery-flow";

/**
 * `/goals` — one route, one guided flow (§15).
 * The visible step (intro → discovery → refinement → review → locked) is
 * derived from the persisted goal status, so refreshes and deep links
 * resume exactly where the student left off.
 */
export default function GoalsPage() {
  return <GoalDiscoveryFlow />;
}
