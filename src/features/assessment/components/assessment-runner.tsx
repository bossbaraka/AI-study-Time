"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Loader2, Pause } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/feedback/states";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ASSESSMENT_ROUTES } from "@/features/assessment/constants/assessment.constants";
import { AssessmentPauseDialog } from "@/features/assessment/components/assessment-pause-dialog";
import { AssessmentProgressBar } from "@/features/assessment/components/assessment-progress";
import { QuestionRenderer } from "@/features/assessment/components/question-renderer";
import {
  useAssessmentSession,
  usePauseAssessment,
  useResumeAssessment,
  useSubmitAnswer,
} from "@/features/assessment/hooks/use-assessment";
import { normalizeAssessmentError } from "@/features/assessment/lib/errors";
import { useI18n, useT } from "@/lib/i18n/provider";
import type {
  AdaptationNote,
  AssessmentResponse,
  SubmitAnswerPayload,
} from "@/types/assessment";

const NOTE_KEYS: Record<AdaptationNote, string> = {
  deepening: "assessment.note.deepening",
  adjusting: "assessment.note.adjusting",
  moving_on: "assessment.note.movingOn",
};

/** Transport-safe unique id for idempotent submissions. */
function newSubmissionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `sub_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Assessment runner — presents the engine's current question, collects the
 * answer, submits it and renders whatever session state comes back.
 *
 * All adaptive logic lives in the engine; this component only reacts to
 * the session model. Failures never silently advance (§16): the same
 * submission (same idempotency key) is retried.
 */
export function AssessmentRunner({ sessionId }: { sessionId: string }) {
  const t = useT();
  const { direction } = useI18n();
  const router = useRouter();

  const sessionQuery = useAssessmentSession(sessionId);
  const submitAnswer = useSubmitAnswer();
  const pauseAssessment = usePauseAssessment();
  const resumeAssessment = useResumeAssessment();

  const [pauseOpen, setPauseOpen] = useState(false);
  /** Holds the in-flight payload so "Try again" replays the SAME submissionId. */
  const pendingPayloadRef = useRef<SubmitAnswerPayload | null>(null);

  const session = sessionQuery.data;

  // Completed sessions belong on the results screen — one-way, no loops.
  useEffect(() => {
    if (session?.status === "completed") {
      router.replace(ASSESSMENT_ROUTES.results(sessionId));
    }
  }, [session?.status, router, sessionId]);

  if (sessionQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <p role="status" className="text-sm text-muted-foreground">
          {t("assessment.starting")}
        </p>
        <PageSkeleton blocks={2} />
      </div>
    );
  }

  if (sessionQuery.isError) {
    const normalized = normalizeAssessmentError(sessionQuery.error);
    return (
      <ErrorState
        title={t("assessment.errors.sessionUnavailable")}
        body={
          normalized.retryable
            ? t(normalized.messageKey)
            : t("assessment.notStartedBody")
        }
        onRetry={
          normalized.retryable ? () => void sessionQuery.refetch() : undefined
        }
        action={
          <Button variant="secondary" onClick={() => router.replace(ASSESSMENT_ROUTES.intro)}>
            {t("assessment.backToStart")}
          </Button>
        }
      />
    );
  }

  if (!session) return null;

  if (session.status === "expired") {
    return (
      <ErrorState
        title={t("assessment.errors.expired")}
        body={t("assessment.notStartedBody")}
        action={
          <Button onClick={() => router.replace(ASSESSMENT_ROUTES.intro)}>
            {t("assessment.backToStart")}
          </Button>
        }
      />
    );
  }

  if (session.status === "paused") {
    return (
      <Card>
        <CardContent className="flex flex-col items-start gap-4 p-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-lg font-semibold tracking-tight">
              {t("assessment.continueTitle")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("assessment.continueBody", {
                count: session.progress.questionsAnswered,
              })}
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => resumeAssessment.mutate(sessionId)}
            disabled={resumeAssessment.isPending}
          >
            {resumeAssessment.isPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            )}
            {t("assessment.resumeCta")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
          {resumeAssessment.isError && (
            <p role="alert" className="text-xs font-medium text-danger-foreground">
              {t(normalizeAssessmentError(resumeAssessment.error).messageKey)}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Completed (redirect in flight) or engine has no further question.
  if (!session.currentQuestion) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center" role="status">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("assessment.completing")}</p>
      </div>
    );
  }

  const question = session.currentQuestion;
  const submitError = submitAnswer.isError
    ? normalizeAssessmentError(submitAnswer.error)
    : null;

  const handleAnswer = (response: AssessmentResponse) => {
    const payload: SubmitAnswerPayload = {
      sessionId,
      response,
      submissionId: newSubmissionId(),
    };
    pendingPayloadRef.current = payload;
    submitAnswer.mutate(payload);
  };

  const handleRetrySubmit = () => {
    const payload = pendingPayloadRef.current;
    if (!payload) return;
    // Same submissionId → the engine deduplicates; progress never double-counts.
    submitAnswer.mutate(payload);
  };

  const handlePauseAndExit = () => {
    pauseAssessment.mutate(sessionId, {
      onSuccess: () => router.push(ASSESSMENT_ROUTES.intro),
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <AssessmentProgressBar progress={session.progress} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 shrink-0"
          onClick={() => setPauseOpen(true)}
        >
          <Pause className="size-4" aria-hidden="true" />
          {t("assessment.pause")}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {submitAnswer.isPending ? (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col items-center gap-4 py-16 text-center"
            role="status"
          >
            <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">{t("assessment.analyzing")}</p>
          </motion.div>
        ) : (
          <motion.div
            key={question.id}
            initial={{ opacity: 0, x: direction === "rtl" ? -16 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction === "rtl" ? 16 : -16 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex flex-col gap-4"
          >
            {session.adaptationNote && (
              <p role="status" className="text-xs font-medium text-primary">
                {t(NOTE_KEYS[session.adaptationNote])}
              </p>
            )}
            <QuestionRenderer
              question={question}
              isSubmitting={submitAnswer.isPending}
              submitError={submitError}
              onRetrySubmit={handleRetrySubmit}
              onAnswer={handleAnswer}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AssessmentPauseDialog
        open={pauseOpen}
        onOpenChange={setPauseOpen}
        questionsAnswered={session.progress.questionsAnswered}
        onPauseAndExit={handlePauseAndExit}
        isPausing={pauseAssessment.isPending}
      />
    </div>
  );
}
