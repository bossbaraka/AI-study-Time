"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  Compass,
  GraduationCap,
  Loader2,
  Route,
  School,
  Sparkles,
  Timer,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { InputField } from "@/components/ui/input";
import { ErrorState } from "@/components/feedback/states";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ASSESSMENT_ROUTES } from "@/features/assessment/constants/assessment.constants";
import {
  useActiveAssessmentSession,
  useCreateAssessmentSession,
} from "@/features/assessment/hooks/use-assessment";
import { normalizeAssessmentError } from "@/features/assessment/lib/errors";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { EducationalStage, StudentAssessmentProfile } from "@/types/assessment";

const EXPECTED_DURATION_MINUTES = 13;

const QUICK_SUBJECTS = [
  "الرياضيات",
  "البرمجة بلغة بايثون",
  "الفيزياء والعلوم",
  "اللغة الإنجليزية",
  "الذكاء الاصطناعي",
  "اللغة العربية والبلاغة",
];

const STAGES: { id: EducationalStage; labelKey: string; icon: typeof School }[] = [
  { id: "elementary", labelKey: "assessment.discovery.stage.elementary", icon: BookOpen },
  { id: "middle", labelKey: "assessment.discovery.stage.middle", icon: School },
  { id: "high_school", labelKey: "assessment.discovery.stage.high_school", icon: GraduationCap },
  { id: "university", labelKey: "assessment.discovery.stage.university", icon: Compass },
  { id: "professional", labelKey: "assessment.discovery.stage.professional", icon: Briefcase },
];

/**
 * Assessment introduction with AI profile discovery:
 * Gathers target subject, student age, and educational stage before generating
 * tailored diagnostic questions.
 */
export function AssessmentIntro() {
  const t = useT();
  const router = useRouter();
  const activeQuery = useActiveAssessmentSession();
  const createSession = useCreateAssessmentSession();
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

  // Discovery Form State
  const [targetSubject, setTargetSubject] = useState("");
  const [age, setAge] = useState(16);
  const [stage, setStage] = useState<EducationalStage>("high_school");
  const [subjectError, setSubjectError] = useState<string | null>(null);

  const startNewSession = (customProfile?: StudentAssessmentProfile) => {
    const subject = (customProfile?.targetSubject ?? targetSubject).trim();
    if (!subject) {
      setSubjectError(t("assessment.discovery.subjectRequired"));
      return;
    }
    setSubjectError(null);

    const profileToUse: StudentAssessmentProfile = customProfile ?? {
      targetSubject: subject,
      age: Number(age) || 16,
      stage,
    };

    createSession.mutate(profileToUse, {
      onSuccess: (session) => {
        setDiscardDialogOpen(false);
        router.push(ASSESSMENT_ROUTES.session(session.id));
      },
    });
  };

  if (activeQuery.isLoading) return <PageSkeleton blocks={2} />;

  if (activeQuery.isError) {
    const normalized = normalizeAssessmentError(activeQuery.error);
    return (
      <ErrorState
        title={t("assessment.errors.sessionUnavailable")}
        body={t(normalized.messageKey)}
        onRetry={normalized.retryable ? () => void activeQuery.refetch() : undefined}
      />
    );
  }

  const active = activeQuery.data ?? null;
  const hasActive =
    active !== null && (active.status === "in_progress" || active.status === "paused");

  return (
    <div className="flex flex-col gap-8">
      <AnimatePresence mode="wait">
        {hasActive && active ? (
          <motion.div
            key="resume"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <CardContent className="flex flex-col items-start gap-5 p-6">
                <div className="flex flex-col gap-2">
                  <p className="micro-label">{t("assessment.title")}</p>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    {t("assessment.continueTitle")}
                  </h1>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {t("assessment.continueBody", {
                      count: active.progress.questionsAnswered,
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    size="lg"
                    onClick={() => router.push(ASSESSMENT_ROUTES.session(active.id))}
                  >
                    {t("assessment.continueCta")}
                    <ArrowRight className="size-4" aria-hidden="true" />
                  </Button>
                  <Button variant="ghost" onClick={() => setDiscardDialogOpen(true)}>
                    {t("assessment.startOver")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col gap-8"
          >
            {/* Header Section */}
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" aria-hidden="true" />
                <span>{t("assessment.discovery.title")}</span>
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                {t("assessment.intro")}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t("assessment.discovery.subtitle")}
              </p>
            </div>

            {/* Interactive Pre-Assessment Discovery Card */}
            <Card className="border-primary/20 bg-surface/80 backdrop-blur-xs">
              <CardContent className="flex flex-col gap-6 p-6">
                {/* 1. Target Subject */}
                <div className="flex flex-col gap-2.5">
                  <InputField
                    label={t("assessment.discovery.subjectLabel")}
                    placeholder={t("assessment.discovery.subjectPlaceholder")}
                    value={targetSubject}
                    onChange={(e) => {
                      setTargetSubject(e.target.value);
                      if (subjectError) setSubjectError(null);
                    }}
                    error={subjectError}
                    disabled={createSession.isPending}
                    autoFocus
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-xs text-muted-foreground me-1">
                      {t("assessment.discovery.quickSuggestions")}:
                    </span>
                    {QUICK_SUBJECTS.map((sub) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => {
                          setTargetSubject(sub);
                          if (subjectError) setSubjectError(null);
                        }}
                        disabled={createSession.isPending}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs transition-colors",
                          targetSubject === sub
                            ? "border-primary bg-primary/15 font-medium text-primary"
                            : "border-border bg-surface-raised text-muted-foreground hover:border-primary/50 hover:text-foreground",
                        )}
                      >
                        {sub}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Age & Stage Group */}
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  {/* Student Age */}
                  <div className="flex flex-col gap-1.5">
                    <InputField
                      type="number"
                      min={6}
                      max={90}
                      label={t("assessment.discovery.ageLabel")}
                      value={age}
                      onChange={(e) => setAge(Math.max(6, Math.min(90, Number(e.target.value) || 16)))}
                      disabled={createSession.isPending}
                    />
                    <p className="text-xs text-muted-foreground">
                      {age} {t("assessment.discovery.ageYears")}
                    </p>
                  </div>

                  {/* Educational Stage Cards */}
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-sm font-medium text-foreground">
                      {t("assessment.discovery.stageLabel")}
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {STAGES.map(({ id, labelKey, icon: StageIcon }) => {
                        const isSelected = stage === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setStage(id)}
                            disabled={createSession.isPending}
                            className={cn(
                              "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-start transition-all",
                              isSelected
                                ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
                                : "border-border bg-surface hover:border-primary/40 hover:bg-surface-raised text-muted-foreground",
                            )}
                          >
                            <StageIcon
                              className={cn("size-4", isSelected ? "text-primary" : "text-muted-foreground")}
                              aria-hidden="true"
                            />
                            <span className="text-xs font-medium leading-tight">
                              {t(labelKey)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Expectations Checklist */}
                <div className="rounded-lg border border-border/60 bg-surface/50 p-4">
                  <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {(
                      [
                        { icon: Compass, text: t("assessment.expectDiagnosis") },
                        { icon: Route, text: t("assessment.expectAdaptive") },
                        {
                          icon: Timer,
                          text: t("assessment.expectDuration", {
                            minutes: EXPECTED_DURATION_MINUTES,
                          }),
                        },
                      ] as const
                    ).map(({ icon: Icon, text }) => (
                      <li key={text} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                        <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Action CTA */}
                <div className="flex flex-col items-start gap-3 pt-2">
                  <Button
                    size="lg"
                    className="w-full sm:w-auto"
                    onClick={() => startNewSession()}
                    disabled={createSession.isPending}
                  >
                    {createSession.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        <span>{t("assessment.discovery.generating")}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4 text-primary-foreground" aria-hidden="true" />
                        <span>{t("assessment.discovery.generateCta")}</span>
                        <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
                      </>
                    )}
                  </Button>

                  {createSession.isPending && (
                    <p role="status" className="text-xs text-muted-foreground animate-pulse">
                      {t("assessment.discovery.generating")}
                    </p>
                  )}

                  {createSession.isError && (
                    <p role="alert" className="text-xs font-medium text-danger-foreground">
                      {t(normalizeAssessmentError(createSession.error).messageKey)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog
        open={discardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        title={t("assessment.startOver")}
        description={t("assessment.startOverWarning")}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setDiscardDialogOpen(false)}
              disabled={createSession.isPending}
            >
              {t("assessment.keepCurrent")}
            </Button>
            <Button
              variant="secondary"
              onClick={() => startNewSession()}
              disabled={createSession.isPending}
            >
              {createSession.isPending && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              {t("assessment.discardAndStart")}
            </Button>
          </>
        }
      />
    </div>
  );
}
