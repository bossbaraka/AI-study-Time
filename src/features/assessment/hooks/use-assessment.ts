/**
 * Assessment hooks — server state lives in TanStack Query only.
 *
 * Mutations write the returned session straight into the session query
 * cache (setQueryData) instead of invalidating: the engine's response is
 * already authoritative, so no extra round-trip and no app-wide refetch.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { assessmentService } from "@/services/assessment.service";
import type { StudentAssessmentProfile, SubmitAnswerPayload } from "@/types/assessment";

export function useCreateAssessmentSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (profile?: StudentAssessmentProfile) => assessmentService.createSession(profile),
    onSuccess: (session) => {
      qc.setQueryData(queryKeys.assessmentSession(session.id), session);
      void qc.invalidateQueries({ queryKey: queryKeys.assessmentActive });
    },
  });
}

/** Most recent unfinished session — powers the "continue where you left off" state. */
export function useActiveAssessmentSession() {
  return useQuery({
    queryKey: queryKeys.assessmentActive,
    queryFn: ({ signal }) => assessmentService.getActiveSession(signal),
  });
}

export function useAssessmentSession(sessionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assessmentSession(sessionId ?? ""),
    queryFn: ({ signal }) => assessmentService.getSession(sessionId ?? "", signal),
    enabled: sessionId !== undefined && sessionId.length > 0,
  });
}

/**
 * Submits an answer. The caller owns the `submissionId` so a retry of the
 * same answer reuses it — the engine deduplicates and progress is never
 * double-counted.
 */
export function useSubmitAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitAnswerPayload) => assessmentService.submitAnswer(payload),
    onSuccess: (session) => {
      qc.setQueryData(queryKeys.assessmentSession(session.id), session);
      void qc.invalidateQueries({ queryKey: queryKeys.assessmentActive });
      if (session.status === "completed") {
        void qc.invalidateQueries({ queryKey: queryKeys.assessmentResults(session.id) });
      }
    },
  });
}

export function usePauseAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => assessmentService.pauseSession(sessionId),
    onSuccess: (session) => {
      qc.setQueryData(queryKeys.assessmentSession(session.id), session);
      void qc.invalidateQueries({ queryKey: queryKeys.assessmentActive });
    },
  });
}

export function useResumeAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => assessmentService.resumeSession(sessionId),
    onSuccess: (session) => {
      qc.setQueryData(queryKeys.assessmentSession(session.id), session);
      void qc.invalidateQueries({ queryKey: queryKeys.assessmentActive });
    },
  });
}

export function useCompleteAssessment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => assessmentService.completeSession(sessionId),
    onSuccess: (session) => {
      qc.setQueryData(queryKeys.assessmentSession(session.id), session);
      void qc.invalidateQueries({ queryKey: queryKeys.assessmentActive });
      void qc.invalidateQueries({ queryKey: queryKeys.assessmentResults(session.id) });
    },
  });
}

/** Latest completed diagnosis — the STEP 5 goal-discovery context (§8). */
export function useLatestAssessmentResult() {
  return useQuery({
    queryKey: queryKeys.assessmentLatestResult,
    queryFn: ({ signal }) => assessmentService.getLatestResult(signal),
  });
}

export function useAssessmentResults(sessionId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.assessmentResults(sessionId ?? ""),
    queryFn: ({ signal }) => assessmentService.getResults(sessionId ?? "", signal),
    enabled: sessionId !== undefined && sessionId.length > 0,
  });
}
