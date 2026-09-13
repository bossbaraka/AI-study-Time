"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Expand,
  HelpCircle,
  LifeBuoy,
  MessageSquareText,
  Minimize2,
  Pause,
  PencilRuler,
  Play,
  ScrollText,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/states";
import { useT } from "@/lib/i18n/provider";
import {
  useCompleteMission,
  useMission,
  useSetDailyStep,
  useSetMissionState,
} from "@/features/journey/hooks/use-journey";
import { useResources } from "@/features/learning/hooks/use-learning";
import { cn, formatCountdown, percent } from "@/lib/utils";

type RunnerStep = "resource" | "practice" | "recall" | "quiz";

const STEPS: { id: RunnerStep; labelKey: string; icon: typeof BookOpen; href?: string }[] = [
  { id: "resource", labelKey: "mission.resource", icon: BookOpen },
  { id: "practice", labelKey: "mission.practice", icon: PencilRuler },
  { id: "recall", labelKey: "mission.recall", icon: BrainCircuit, href: "/app/recall" },
  { id: "quiz", labelKey: "mission.quiz", icon: ScrollText, href: "/app/tests" },
];

/**
 * Mission runner — the focused execution surface.
 * Timer, ordered steps, complete/pause/resume, mentor escape hatch.
 * Focus mode strips the shell chrome down to the mission itself.
 */
export function MissionRunner() {
  const t = useT();
  const missionQuery = useMission();
  const resourcesQuery = useResources(missionQuery.data?.moduleId);
  const setState = useSetMissionState();
  const completeMission = useCompleteMission();
  const setDailyStep = useSetDailyStep();

  const [focusMode, setFocusMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<RunnerStep>>(new Set());
  const [finished, setFinished] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mission = missionQuery.data;
  const running = mission?.state === "in-progress";

  // Persist elapsed seconds locally; flush to service on pause/complete.
  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [running]);

  useEffect(() => {
    if (mission) setElapsed(mission.elapsedSeconds);
    if (mission?.state === "completed") setFinished(true);
  }, [mission?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleStep = useCallback(
    (step: RunnerStep) => {
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        if (next.has(step)) next.delete(step);
        else next.add(step);
        return next;
      });
      if (step === "recall") {
        setDailyStep.mutate({ step: "recall", state: "active" });
      }
    },
    [setDailyStep],
  );

  const start = () => setState.mutate("in-progress");
  const pause = () => setState.mutate("paused");

  const complete = async () => {
    if (!mission) return;
    await completeMission.mutateAsync();
    setDailyStep.mutate({ step: "practice", state: "done" });
    setFinished(true);
  };

  if (missionQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4" role="status" aria-busy="true">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (missionQuery.isError || !mission) {
    return (
      <ErrorState
        title={t("state.error.title")}
        body={t("state.error.body")}
        onRetry={() => void missionQuery.refetch()}
      />
    );
  }

  const stepProgress = percent(completedSteps.size, STEPS.length);
  const primaryResource = resourcesQuery.data?.[0];

  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        focusMode && "mx-auto max-w-2xl",
      )}
    >
      {/* Focus mode control */}
      <div className="flex items-center justify-between gap-3">
        <Badge tone={running ? "primary" : "neutral"}>
          {t("mission.title")} · {mission.phaseTitle}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFocusMode((f) => !f)}
          aria-pressed={focusMode}
        >
          {focusMode ? <Minimize2 aria-hidden="true" /> : <Expand aria-hidden="true" />}
          {focusMode ? t("mission.exitFocus") : t("mission.focusMode")}
        </Button>
      </div>

      {focusMode && (
        <p className="-mt-3 text-xs text-muted-foreground" role="note">
          {t("mission.focusModeHint")}
        </p>
      )}

      <AnimatePresence mode="wait">
        {finished ? (
          /* Completion state — completion ≠ mastery, stated plainly */
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center gap-5 rounded-xl border border-success/30 bg-surface p-10 text-center"
          >
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 15 }}
              className="flex size-14 items-center justify-center rounded-full border border-success/40 bg-success-subtle text-success"
            >
              <CheckCircle2 className="size-7" aria-hidden="true" />
            </motion.span>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{t("mission.completedTitle")}</h2>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                {t("mission.completedBody")}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/app/mastery">
                <Button variant="secondary">{t("mission.toMastery")}</Button>
              </Link>
              <Link href="/app/recall">
                <Button>{t("dashboard.step.recall")}</Button>
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.div key="runner" exit={{ opacity: 0 }} className="flex flex-col gap-6">
            {/* Mission header + timer */}
            <section className="rounded-xl border border-border bg-surface p-6">
              <h1 className="text-2xl font-semibold tracking-tight">{mission.topic}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">{t("mission.objective")}: </span>
                {mission.objective}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="micro-label">{t("mission.timeSpent")}</span>
                  <span
                    className={cn(
                      "tabular rounded-md border px-2.5 py-1 text-sm font-semibold",
                      running
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border bg-background text-muted-foreground",
                    )}
                    role="timer"
                    aria-live="off"
                  >
                    {formatCountdown(elapsed)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    / {mission.estimatedMinutes} {t("common.minutes")}
                  </span>
                </div>
                <Badge tone="neutral">{t(`difficulty.${mission.difficulty}`)}</Badge>
              </div>

              {/* Transport controls */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {!running ? (
                  <Button
                    size="lg"
                    onClick={() => void start()}
                    disabled={setState.isPending}
                  >
                    <Play aria-hidden="true" />
                    {mission.state === "paused" || elapsed > 0 ? t("common.resume") : t("common.start")}
                  </Button>
                ) : (
                  <Button size="lg" variant="secondary" onClick={() => void pause()}>
                    <Pause aria-hidden="true" />
                    {t("common.pause")}
                  </Button>
                )}
                <Button
                  size="lg"
                  variant={running ? "primary" : "outline"}
                  onClick={() => void complete()}
                  disabled={completeMission.isPending}
                >
                  <CheckCircle2 aria-hidden="true" />
                  {t("common.complete")}
                </Button>
                <Link href="/app/mentor" className="ms-auto">
                  <Button variant="ghost">
                    <MessageSquareText aria-hidden="true" />
                    {t("common.askMentor")}
                  </Button>
                </Link>
              </div>
            </section>

            {/* Steps */}
            <section aria-label={t("mission.progress")} className="rounded-xl border border-border bg-surface p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="micro-label">{t("mission.progress")}</h2>
                <span className="tabular text-xs font-medium text-muted-foreground">{stepProgress}%</span>
              </div>
              <Progress value={stepProgress} className="mt-2" />

              <ul className="mt-5 flex flex-col gap-2">
                {STEPS.map((step) => {
                  const done = completedSteps.has(step.id);
                  const Icon = step.icon;
                  const inner = (
                    <>
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors",
                          done
                            ? "border-success/40 bg-success-subtle text-success"
                            : "border-border bg-background text-muted-foreground",
                        )}
                      >
                        {done ? <CheckCircle2 className="size-4" aria-hidden="true" /> : <Icon className="size-4" aria-hidden="true" />}
                      </span>
                      <span className="flex-1 text-sm font-medium">
                        {t(step.labelKey)}
                        {step.id === "resource" && primaryResource && (
                          <span className="block text-xs font-normal text-muted-foreground">
                            {primaryResource.title} · {primaryResource.provider} · {primaryResource.durationMinutes} {t("common.minutes")}
                          </span>
                        )}
                      </span>
                    </>
                  );

                  return (
                    <li key={step.id}>
                      {step.href && !done ? (
                        <Link
                          href={step.href}
                          className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:border-border-strong focus-visible:shadow-focus focus-visible:outline-none"
                        >
                          {inner}
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => toggleStep(step.id)}
                          aria-pressed={done}
                          className="flex w-full items-center gap-3 rounded-lg border border-border bg-background p-3 text-start transition-colors hover:border-border-strong focus-visible:shadow-focus focus-visible:outline-none"
                        >
                          {inner}
                          <span className="text-2xs text-muted-foreground">
                            {done ? t("common.completed") : t("mission.completeStep")}
                          </span>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* Help */}
            <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <HelpCircle className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold">{t("mission.help.title")}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t("mission.help.body")}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href="/app/mentor">
                  <Button variant="secondary" size="sm">
                    <MessageSquareText aria-hidden="true" />
                    {t("common.askMentor")}
                  </Button>
                </Link>
                <Link href="/app/recovery">
                  <Button variant="ghost" size="sm">
                    <LifeBuoy aria-hidden="true" />
                    {t("nav.recovery")}
                  </Button>
                </Link>
              </div>
            </section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
