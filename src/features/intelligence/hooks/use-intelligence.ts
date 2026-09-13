import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import {
  behaviorService,
  mentorService,
  recoveryService,
} from "@/services/intelligence.service";
import type { RecoveryStep } from "@/constants/journey";

export function useBehaviorProfile() {
  return useQuery({
    queryKey: queryKeys.behavior,
    queryFn: ({ signal }) => behaviorService.getProfile(signal),
  });
}

export function useActiveRecovery() {
  return useQuery({
    queryKey: queryKeys.recovery,
    queryFn: ({ signal }) => recoveryService.getActive(signal),
  });
}

export function useAdvanceRecoveryStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (step: RecoveryStep) => recoveryService.advanceStep(step),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.recovery });
      void qc.invalidateQueries({ queryKey: queryKeys.mastery });
    },
  });
}

export function useMentorContext() {
  return useQuery({
    queryKey: [...queryKeys.mentor, "context"],
    queryFn: ({ signal }) => mentorService.getContext(signal),
  });
}

export function useMentorMessages() {
  return useQuery({
    queryKey: queryKeys.mentorMessages,
    queryFn: ({ signal }) => mentorService.listMessages(signal),
  });
}

export function useSendMentorMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => mentorService.send(content),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.mentorMessages });
    },
  });
}
