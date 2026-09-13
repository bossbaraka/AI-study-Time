"use client";

import { RoadmapFlow } from "@/features/roadmap/components/roadmap-flow";

/**
 * `/roadmap` — the student's active roadmap (§21).
 * No locked goal → the flow redirects to /goals; generation is explicit
 * and idempotent; refreshes restore the persisted roadmap.
 */
export default function RoadmapPage() {
  return <RoadmapFlow />;
}
