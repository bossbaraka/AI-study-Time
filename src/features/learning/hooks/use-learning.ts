import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import {
  masteryService,
  recallService,
  resourceService,
  testService,
} from "@/services/learning.service";
import type { ConfidenceLevel, TestResultAnswer } from "@/types/domain";

export function useResources(moduleId?: string) {
  return useQuery({
    queryKey: queryKeys.resources(moduleId),
    queryFn: ({ signal }) =>
      moduleId ? resourceService.forModule(moduleId, signal) : resourceService.list(signal),
  });
}

export function useDueRecallCards() {
  return useQuery({
    queryKey: queryKeys.recallCards,
    queryFn: ({ signal }) => recallService.listDue(signal),
  });
}

export function useRecallStats() {
  return useQuery({
    queryKey: queryKeys.recallStats,
    queryFn: ({ signal }) => recallService.stats(signal),
  });
}

export function useAnswerRecall() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, confidence }: { cardId: string; confidence: ConfidenceLevel }) =>
      recallService.answer(cardId, confidence),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.recall });
      void qc.invalidateQueries({ queryKey: queryKeys.dailyPlan });
    },
  });
}

export function useTests() {
  return useQuery({
    queryKey: queryKeys.tests,
    queryFn: ({ signal }) => testService.list(signal),
  });
}

export function useTest(id: string) {
  return useQuery({
    queryKey: [...queryKeys.tests, id],
    queryFn: ({ signal }) => testService.get(id, signal),
    enabled: id.length > 0,
  });
}

export function useTestResults() {
  return useQuery({
    queryKey: [...queryKeys.tests, "results"],
    queryFn: ({ signal }) => testService.results(signal),
  });
}

export function useSubmitTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      testId,
      answers,
      timeSpentSeconds,
    }: {
      testId: string;
      answers: TestResultAnswer[];
      timeSpentSeconds: number;
    }) => testService.submit(testId, answers, timeSpentSeconds),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.tests });
      void qc.invalidateQueries({ queryKey: queryKeys.mastery });
      void qc.invalidateQueries({ queryKey: queryKeys.recovery });
      void qc.invalidateQueries({ queryKey: queryKeys.dailyPlan });
    },
  });
}

export function useMastery() {
  return useQuery({
    queryKey: queryKeys.mastery,
    queryFn: ({ signal }) => masteryService.list(signal),
  });
}
