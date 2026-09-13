"use client";

import { useParams } from "next/navigation";
import { PageSkeleton } from "@/components/ui/skeleton";
import { UnitLearnFlow } from "@/features/execution/components/unit-learn-flow";

/**
 * `/roadmap/learn/[unitId]` — the execution screen for one learning unit
 * (Phase 7). The unit id is a curriculum pointer only: ownership,
 * roadmap resolution and dependency checks all happen server-side.
 */
export default function LearnUnitPage() {
  const params = useParams<{ unitId: string }>();
  if (!params?.unitId) return <PageSkeleton blocks={2} />;
  return <UnitLearnFlow learningUnitId={params.unitId} />;
}
