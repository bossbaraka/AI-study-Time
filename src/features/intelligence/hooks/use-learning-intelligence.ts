import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import {
  masteryApiService,
  diagnosisService,
  adaptiveService,
  behaviorApiService,
  recoveryApiService,
  recallScheduleService,
  evidenceService,
} from "@/services/intelligence-api.service";

export function useMasteryView() {
  return useQuery({
    queryKey: ["mastery", "view"],
    queryFn: ({ signal }) => masteryApiService.getView(signal),
  });
}

export function useDiagnosis() {
  return useQuery({
    queryKey: ["diagnosis"],
    queryFn: ({ signal }) => diagnosisService.list(signal),
  });
}

export function useAdaptiveNext(params?: { goalId?: string; roadmapId?: string; currentUnitId?: string }) {
  return useQuery({
    queryKey: ["adaptive", "next", params],
    queryFn: ({ signal }) => adaptiveService.getNext(params, signal),
  });
}

export function useBehaviorInsights() {
  return useQuery({
    queryKey: ["behavior", "insights"],
    queryFn: ({ signal }) => behaviorApiService.get(signal),
  });
}

export function useRecoveryPlans() {
  return useQuery({
    queryKey: ["recovery", "plans"],
    queryFn: ({ signal }) => recoveryApiService.list(signal),
  });
}

export function useRecallDue() {
  return useQuery({
    queryKey: ["recall", "due"],
    queryFn: ({ signal }) => recallScheduleService.listDue(signal),
  });
}

export function useEvidence() {
  return useQuery({
    queryKey: ["evidence"],
    queryFn: ({ signal }) => evidenceService.list(signal),
  });
}
