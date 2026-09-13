/**
 * Execution hooks — server state in TanStack Query only (§17).
 *
 * Refresh safety: every screen reads execution state from these queries
 * (engine-persisted), never from localStorage or UI memory. Mutations
 * refresh the unit context and the roadmap-wide view so derived states
 * (badges, current unit, next unit) stay consistent.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { executionService } from "@/services/execution.service";
import type { EvidenceInput } from "@/types/execution";

/** Runtime view over the active roadmap (unit states + current unit). */
export function useExecutionView() {
  return useQuery({
    queryKey: queryKeys.executionView,
    queryFn: ({ signal }) => executionService.getExecutionView(signal),
  });
}

/** Learn-screen context for one unit; disabled until an id is known. */
export function useUnitContext(unitId: string | null) {
  return useQuery({
    queryKey: queryKeys.executionUnit(unitId ?? ""),
    enabled: unitId !== null,
    queryFn: ({ signal }) => {
      if (unitId === null) {
        // Unreachable while `enabled` gates the query — defensive only.
        return Promise.reject(new Error("unit context queried without a unit id"));
      }
      return executionService.getUnitContext(unitId, signal);
    },
  });
}

function useExecutionInvalidator() {
  const qc = useQueryClient();
  return (unitId: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.executionUnit(unitId) });
    qc.invalidateQueries({ queryKey: queryKeys.executionView });
    // Roadmap timeline badges derive from the execution view only, but the
    // roadmap query cache is untouched by design — the plan never changes.
  };
}

/** Start is idempotent server-side — double clicks never duplicate (§16). */
export function useStartUnit() {
  const invalidate = useExecutionInvalidator();
  return useMutation({
    mutationFn: (unitId: string) => executionService.startLearningUnit(unitId),
    onSuccess: (_execution, unitId) => invalidate(unitId),
  });
}

export function useSubmitEvidence() {
  const invalidate = useExecutionInvalidator();
  return useMutation({
    mutationFn: ({ unitId, input }: { unitId: string; input: EvidenceInput }) =>
      executionService.submitEvidence(unitId, input),
    onSuccess: (_execution, { unitId }) => invalidate(unitId),
  });
}

export function useEvaluateUnit() {
  const invalidate = useExecutionInvalidator();
  return useMutation({
    mutationFn: (unitId: string) => executionService.evaluateExecution(unitId),
    onSuccess: (_execution, unitId) => invalidate(unitId),
  });
}
