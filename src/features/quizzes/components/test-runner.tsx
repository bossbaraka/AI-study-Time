"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, ArrowRight, Clock3, Flag } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { TextAreaField } from "@/components/ui/textarea";
import { useT } from "@/lib/i18n/provider";
import { cn, formatCountdown, percent } from "@/lib/utils";
import type { Test, TestResult, TestResultAnswer } from "@/types/domain";

/**
 * Test runner — professional assessment interface:
 * question navigation grid, timer when required, answer states,
 * review before submit, submit confirmation.
 */
export function TestRunner({
  test,
  onSubmit,
  onExit,
}: {
  test: Test;
  onSubmit: (answers: TestResultAnswer[], timeSpentSeconds: number) => Promise<TestResult>;
  onExit: () => void;
}) {
  const t = useT();
  const [current, setCurrent] = useState(0);
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(
    test.timeLimitMinutes ? test.timeLimitMinutes * 60 : null,
  );
  const startedAt = useRef(Date.now());

  const questions = test.questions;
  const question = questions[current];

  // Timer when required; auto-submit at zero is intentionally avoided —
  // instead the student is warned, then submits deliberately.
  useEffect(() => {
    if (secondsLeft === null) return;
    const timer = setInterval(() => setSecondsLeft((s) => (s === null ? null : Math.max(0, s - 1))), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const answeredIds = useMemo(
    () =>
      new Set(
        questions
          .filter((q) =>
            q.kind === "multiple-choice"
              ? choices[q.id] !== undefined
              : (texts[q.id] ?? "").trim().length > 0,
          )
          .map((q) => q.id),
      ),
    [questions, choices, texts],
  );

  const unansweredCount = questions.length - answeredIds.size;

  const gradeChoice = useCallback(
    (q: (typeof questions)[number]): boolean =>
      q.kind === "multiple-choice"
        ? choices[q.id] === q.correctChoiceIndex
        : (texts[q.id] ?? "").trim().length > 0, // free-text graded server-side in production
    [choices, texts],
  );

  const submit = async () => {
    setSubmitting(true);
    const answers: TestResultAnswer[] = questions.map((q) => ({
      questionId: q.id,
      correct: gradeChoice(q),
      givenChoiceIndex: choices[q.id],
      givenText: texts[q.id],
    }));
    const timeSpentSeconds = Math.round((Date.now() - startedAt.current) / 1000);
    await onSubmit(answers, timeSpentSeconds);
    setSubmitting(false);
  };

  if (!question) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header: progress + timer */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge tone="neutral">{test.phaseTitle}</Badge>
        <div className="flex items-center gap-4">
          {secondsLeft !== null && (
            <span
              className={cn(
                "tabular flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-semibold",
                secondsLeft < 60
                  ? "border-danger/40 bg-danger-subtle text-danger-foreground"
                  : "border-border bg-surface text-muted-foreground",
              )}
              role="timer"
              aria-live={secondsLeft < 60 ? "assertive" : "off"}
            >
              <Clock3 className="size-3.5" aria-hidden="true" />
              {formatCountdown(secondsLeft)}
            </span>
          )}
          <span className="tabular text-sm font-medium text-muted-foreground">
            {t("tests.runner.answered")}: {answeredIds.size} / {questions.length}
          </span>
        </div>
      </div>

      <Progress value={percent(current + 1, questions.length)} aria-label={t("tests.runner.title")} />

      <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
        <AnimatePresence mode="wait">
          <motion.section
            key={reviewing ? "review" : question.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="rounded-xl border border-border bg-surface p-6 sm:p-8"
            aria-label={reviewing ? t("tests.runner.review") : `${t("tests.runner.questionNav")} ${current + 1}`}
          >
            {reviewing ? (
              <div className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold tracking-tight">{t("tests.runner.review")}</h2>
                <ul className="flex flex-col gap-2">
                  {questions.map((q, i) => (
                    <li key={q.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setReviewing(false);
                          setCurrent(i);
                        }}
                        className="flex w-full items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5 text-start text-sm transition-colors hover:border-border-strong focus-visible:shadow-focus focus-visible:outline-none"
                      >
                        <span className="tabular text-xs text-muted-foreground">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="flex-1 truncate">{q.prompt}</span>
                        {answeredIds.has(q.id) ? (
                          <Badge tone="success">{t("tests.runner.answered")}</Badge>
                        ) : (
                          <Badge tone="warning">{t("tests.runner.unanswered")}</Badge>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setReviewing(false)}>
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    {t("common.back")}
                  </Button>
                  <Button onClick={() => setConfirmOpen(true)}>
                    <Flag className="size-4" aria-hidden="true" />
                    {t("tests.runner.submit")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                <div>
                  <p className="tabular text-2xs font-semibold text-muted-foreground">
                    {t("tests.runner.questionNav")} · {current + 1} / {questions.length} ·{" "}
                    {question.points} pts
                  </p>
                  <h2 className="mt-2 text-lg font-semibold leading-snug tracking-tight sm:text-xl">
                    {question.prompt}
                  </h2>
                </div>

                {question.kind === "multiple-choice" && question.choices && (
                  <div role="radiogroup" aria-label={question.prompt} className="flex flex-col gap-2">
                    {question.choices.map((option, i) => (
                      <button
                        key={option}
                        type="button"
                        role="radio"
                        aria-checked={choices[question.id] === i}
                        onClick={() => setChoices((c) => ({ ...c, [question.id]: i }))}
                        className={cn(
                          "rounded-md border px-4 py-3 text-start text-sm transition-colors focus-visible:shadow-focus focus-visible:outline-none",
                          choices[question.id] === i
                            ? "border-primary/50 bg-primary/10 font-medium text-primary"
                            : "border-border bg-background hover:border-border-strong",
                        )}
                      >
                        <span className="tabular me-2 text-xs text-muted-foreground">
                          {String.fromCharCode(65 + i)}.
                        </span>
                        {option}
                      </button>
                    ))}
                  </div>
                )}

                {(question.kind === "short-answer" || question.kind === "scenario") && (
                  <TextAreaField
                    label={question.prompt}
                    hideLabel
                    rows={5}
                    placeholder={t("assessment.typePlaceholder")}
                    value={texts[question.id] ?? ""}
                    onChange={(e) => setTexts((v) => ({ ...v, [question.id]: e.target.value }))}
                  />
                )}

                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="ghost"
                    onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                    disabled={current === 0}
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" />
                    {t("tests.runner.prev")}
                  </Button>
                  {current < questions.length - 1 ? (
                    <Button onClick={() => setCurrent((c) => c + 1)}>
                      {t("tests.runner.next")}
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </Button>
                  ) : (
                    <Button onClick={() => setReviewing(true)}>
                      {t("tests.runner.review")}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </motion.section>
        </AnimatePresence>

        {/* Question navigation grid */}
        <aside className="order-first lg:order-none" aria-label={t("tests.runner.questionNav")}>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="micro-label mb-3">{t("tests.runner.questionNav")}</p>
            <div className="grid grid-cols-6 gap-1.5 lg:grid-cols-5">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => {
                    setReviewing(false);
                    setCurrent(i);
                  }}
                  aria-label={`${t("tests.runner.questionNav")} ${i + 1}`}
                  aria-current={i === current && !reviewing}
                  className={cn(
                    "tabular flex size-8 items-center justify-center rounded-md border text-xs font-medium transition-colors focus-visible:shadow-focus focus-visible:outline-none",
                    i === current && !reviewing
                      ? "border-primary bg-primary text-primary-foreground"
                      : answeredIds.has(q.id)
                        ? "border-success/40 bg-success-subtle text-success-foreground"
                        : "border-border bg-background text-muted-foreground hover:border-border-strong",
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="mt-4 w-full" onClick={onExit}>
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              {t("common.cancel")}
            </Button>
          </div>
        </aside>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("tests.runner.submitConfirm.title")}
        description={
          unansweredCount > 0
            ? t("tests.runner.submitConfirm.body", { unanswered: unansweredCount })
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              {t("common.back")}
            </Button>
            <Button onClick={() => void submit()} disabled={submitting}>
              <Flag className="size-4" aria-hidden="true" />
              {t("tests.runner.submit")}
            </Button>
          </>
        }
      />
    </div>
  );
}
