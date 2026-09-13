"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  CheckCircle2,
  LifeBuoy,
  RotateCcw,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressRing } from "@/components/charts/progress-ring";
import { SectionBlock } from "@/components/layout/section-block";
import { useT } from "@/lib/i18n/provider";
import { cn, formatDuration } from "@/lib/utils";
import type { Test, TestResult } from "@/types/domain";

/**
 * Test result — never just a score.
 * Score → strong topics → needs review → recommendation with reason,
 * then per-question review with explanations.
 */
export function TestResultView({ result, test }: { result: TestResult; test?: Test }) {
  const t = useT();
  const [showReview, setShowReview] = useState(false);

  const tone = result.score >= 80 ? "mastery" : result.score >= 65 ? "warning" : "primary";
  const recommendationMeta = {
    continue: { icon: ThumbsUp, href: "/app/roadmap", labelKey: "tests.recommendation.continue" },
    "review-then-continue": { icon: RotateCcw, href: "/app/recall", labelKey: "tests.recommendation.review-then-continue" },
    "recovery-session": { icon: LifeBuoy, href: "/app/recovery", labelKey: "tests.recommendation.recovery-session" },
  }[result.recommendation];
  const RecIcon = recommendationMeta.icon;

  return (
    <div className="flex flex-col gap-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="rounded-xl border border-border bg-surface p-6 sm:p-8"
      >
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start">
          <ProgressRing value={result.score} size={132} tone={tone} label={t("tests.result.score")}>
            <span className="tabular text-3xl font-semibold">{result.score}%</span>
            <span className="text-2xs text-muted-foreground">{t("tests.result.score")}</span>
          </ProgressRing>

          <div className="flex min-w-0 flex-1 flex-col gap-5">
            {test && (
              <div>
                <h1 className="text-xl font-semibold tracking-tight">{test.title}</h1>
                <p className="tabular mt-1 text-xs text-muted-foreground">
                  {formatDuration(Math.round(result.timeSpentSeconds / 60))} ·{" "}
                  {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(result.submittedAt))}
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="micro-label flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-success" aria-hidden="true" />
                  {t("tests.result.strong")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result.strongTopics.length > 0 ? (
                    result.strongTopics.map((topic) => (
                      <Badge key={topic} tone="success">{topic}</Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
              <div>
                <p className="micro-label flex items-center gap-1.5">
                  <XCircle className="size-3.5 text-warning" aria-hidden="true" />
                  {t("tests.result.needsReview")}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {result.needsReviewTopics.length > 0 ? (
                    result.needsReviewTopics.map((topic) => (
                      <Badge key={topic} tone="warning">{topic}</Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recommendation — the result always says what to do next */}
        <div className="mt-8 flex flex-col gap-4 rounded-lg border border-primary/30 bg-primary/8 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <RecIcon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">{t("tests.result.recommended")}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{result.recommendationReason}</p>
            </div>
          </div>
          <Link href={recommendationMeta.href} className="shrink-0">
            <Button>
              {t(recommendationMeta.labelKey)}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
          </Link>
        </div>

        <Button variant="ghost" className="mt-4" onClick={() => setShowReview((s) => !s)} aria-expanded={showReview}>
          {t("tests.result.reviewAnswers")}
          <ArrowRight className={cn("size-4 transition-transform", showReview && "rotate-90")} aria-hidden="true" />
        </Button>
      </motion.div>

      {showReview && test && (
        <SectionBlock label={t("tests.result.reviewAnswers")}>
          <ul className="flex flex-col gap-3">
            {test.questions.map((q, i) => {
              const answer = result.answers.find((a) => a.questionId === q.id);
              const correct = answer?.correct ?? false;
              return (
                <li
                  key={q.id}
                  className={cn(
                    "rounded-lg border bg-surface p-5",
                    correct ? "border-success/25" : "border-danger/25",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                        correct ? "bg-success-subtle text-success" : "bg-danger-subtle text-danger",
                      )}
                    >
                      {correct ? (
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                      ) : (
                        <XCircle className="size-3.5" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="tabular text-2xs text-muted-foreground">
                        {String(i + 1).padStart(2, "0")} · {q.topic}
                      </p>
                      <p className="mt-1 text-sm font-medium">{q.prompt}</p>
                      {answer?.givenText && (
                        <p className="mt-2 rounded-md border border-border bg-background p-3 text-xs leading-relaxed text-muted-foreground">
                          {answer.givenText}
                        </p>
                      )}
                      <div className="mt-3 flex gap-2">
                        <Badge tone={correct ? "success" : "danger"}>
                          {correct ? t("tests.result.correct") : t("tests.result.incorrect")}
                        </Badge>
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        <span className="font-semibold text-foreground">{t("tests.result.explanation")}: </span>
                        {q.explanation}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionBlock>
      )}
    </div>
  );
}
