/**
 * Roadmap hooks — server state in TanStack Query only.
 * Generation writes the engine's roadmap straight into the active-roadmap
 * cache (setQueryData): the engine is authoritative, no refetch needed.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { roadmapService } from "@/services/roadmap.service";

export function useActiveRoadmap() {
  return useQuery({
    queryKey: queryKeys.roadmapActive,
    queryFn: ({ signal }) => roadmapService.getActiveRoadmap(signal),
  });
}

/**
 * Generation is idempotent server-side (studentId + goalId + goalVersion +
 * engineVersion), so double clicks and retries can never duplicate a
 * roadmap (§19).
 */
export function useGenerateRoadmap() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) => roadmapService.generateRoadmap(goalId),
    onSuccess: ({ roadmap }) => {
      qc.setQueryData(queryKeys.roadmapActive, roadmap);
      // A new roadmap changes the Phase 7 execution view (current unit).
      qc.invalidateQueries({ queryKey: queryKeys.executionView });
    },
  });
}
