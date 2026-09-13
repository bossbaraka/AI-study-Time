import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import {
  achievementService,
  certificateService,
  guardianService,
  notificationService,
  subscriptionService,
} from "@/services/engagement.service";
import type { SubscriptionTier } from "@/types/domain";

export function useAchievements() {
  return useQuery({
    queryKey: queryKeys.achievements,
    queryFn: ({ signal }) => achievementService.list(signal),
  });
}

export function useCertificates() {
  return useQuery({
    queryKey: queryKeys.certificates,
    queryFn: ({ signal }) => certificateService.list(signal),
  });
}

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: ({ signal }) => notificationService.list(signal),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

export function useSubscriptionPlans() {
  return useQuery({
    queryKey: queryKeys.plans,
    queryFn: ({ signal }) => subscriptionService.listPlans(signal),
  });
}

export function useChangeSubscriptionTier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tier: SubscriptionTier) => subscriptionService.changeTier(tier),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.plans });
      void qc.invalidateQueries({ queryKey: queryKeys.student });
    },
  });
}

export function useGuardianSummary() {
  return useQuery({
    queryKey: queryKeys.guardian,
    queryFn: ({ signal }) => guardianService.getSummary(signal),
  });
}
