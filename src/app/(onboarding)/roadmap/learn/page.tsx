"use client";

import { LearnIndexFlow } from "@/features/execution/components/learn-index-flow";

/**
 * `/roadmap/learn` — resolves the student's ONE current unit from domain
 * state and forwards to its learn screen. Never renders a list: the
 * current unit is derived (roadmap order + dependency graph), not chosen.
 */
export default function LearnIndexPage() {
  return <LearnIndexFlow />;
}
