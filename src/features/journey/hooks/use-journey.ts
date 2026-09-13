import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import {
  dailyPlanService,
  goalService,
  missionService,
  roadmapService,
  studentService,
} from "@/services/journey.service";
import type { DailyStepState } from "@/types/domain";
import type { DailyLoopStep } from "@/constants/journey";
import type { MissionState } from "@/types/domain";

/** Server-state hooks. Components never call services directly. */

export function useStudent() {
  return useQuery({
    queryKey: queryKeys.student,
    queryFn: ({ signal }) => studentService.getCurrent(signal),
  });
}

export function useGoal() {
  return useQuery({
    queryKey: queryKeys.goal,
    queryFn: ({ signal }) => goalService.getCurrent(signal),
  });
}

export function useRoadmap() {
  return useQuery({
    queryKey: queryKeys.roadmap,
    queryFn: ({ signal }) => roadmapService.getCurrent(signal),
  });
}

export function useDailyPlan() {
  return useQuery({
    queryKey: queryKeys.dailyPlan,
    queryFn: ({ signal }) => dailyPlanService.getToday(signal),
  });
}

export function useMission() {
  return useQuery({
    queryKey: queryKeys.mission(),
    queryFn: ({ signal }) => missionService.getCurrent(signal),
  });
}

export function useRequestGoalChange() {
  return useMutation({
    mutationFn: (reason: string) => goalService.requestChange(reason),
  });
}

export function useSetMissionState() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (state: MissionState) => missionService.setState(state),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.mission() });
      void qc.invalidateQueries({ queryKey: queryKeys.dailyPlan });
    },
  });
}

export function useCompleteMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => missionService.complete(),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.mission() });
      void qc.invalidateQueries({ queryKey: queryKeys.dailyPlan });
    },
  });
}

export function useSetDailyStep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ step, state }: { step: DailyLoopStep; state: DailyStepState }) =>
      dailyPlanService.setStepState(step, state),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.dailyPlan });
    },
  });
}

/** Greeting key derived from local time — presentation logic, kept in a hook. */
export function useGreetingKey(): "greeting.morning" | "greeting.afternoon" | "greeting.evening" {
  const hour = new Date().getHours();
  return useMemo(() => {
    if (hour < 12) return "greeting.morning" as const;
    if (hour < 17) return "greeting.afternoon" as const;
    return "greeting.evening" as const;
  }, [hour]);
}
