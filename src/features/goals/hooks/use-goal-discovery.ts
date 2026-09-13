/**
 * Goal discovery hooks — server state in TanStack Query only.
 *
 * Mutations write the engine's response straight into the discovery query
 * cache (setQueryData): the returned goal is authoritative, so there is no
 * refetch round-trip and no app-wide invalidation. The UI never changes
 * `goal.status` itself — every transition arrives from the engine.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { goalDiscoveryService } from "@/services/goal-discovery.service";
import type { GoalDiscoveryInput, GoalRefinePatch } from "@/types/goal";

export function useActiveDiscoveryGoal() {
  return useQuery({
    queryKey: queryKeys.goalDiscovery,
    queryFn: ({ signal }) => goalDiscoveryService.getActiveGoal(signal),
  });
}

export function useCreateDiscoveryGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ input, idempotencyKey }: { input: GoalDiscoveryInput; idempotencyKey: string }) =>
      goalDiscoveryService.createGoal(input, idempotencyKey),
    onSuccess: ({ goal }) => {
      qc.setQueryData(queryKeys.goalDiscovery, goal);
    },
  });
}

export function useUpdateDiscoveryGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, patch }: { goalId: string; patch: GoalRefinePatch }) =>
      goalDiscoveryService.updateGoal(goalId, patch),
    onSuccess: ({ goal }) => {
      qc.setQueryData(queryKeys.goalDiscovery, goal);
    },
  });
}

export function useLockDiscoveryGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, idempotencyKey }: { goalId: string; idempotencyKey: string }) =>
      goalDiscoveryService.lockGoal(goalId, idempotencyKey),
    onSuccess: (goal) => {
      qc.setQueryData(queryKeys.goalDiscovery, goal);
    },
  });
}

/** Explicit revision — the only path from a locked goal back to editing (§5). */
export function useReviseDiscoveryGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) => goalDiscoveryService.reviseGoal(goalId),
    onSuccess: ({ goal }) => {
      qc.setQueryData(queryKeys.goalDiscovery, goal);
    },
  });
}
