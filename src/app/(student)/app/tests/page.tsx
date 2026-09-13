"use client";

import { ScrollText } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs";
import { EmptyState, ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { SectionBlock } from "@/components/layout/section-block";
import { TestRunner } from "@/features/quizzes/components/test-runner";
import { TestResultView } from "@/features/quizzes/components/test-result-view";
import {
  useSubmitTest,
  useTestResults,
  useTests,
} from "@/features/learning/hooks/use-learning";
import { useT } from "@/lib/i18n/provider";
import { formatDuration } from "@/lib/utils";
import type { Test, TestResult } from "@/types/domain";


export default function TestsPage() {
  const t = useT();
  const testsQuery = useTests();
  const resultsQuery = useTestResults();
  const submitTest = useSubmitTest();

  const [activeTest, setActiveTest] = useState<Test | null>(null);
  const [lastResult, setLastResult] = useState<TestResult | null>(null);

  if (testsQuery.isLoading) return <PageSkeleton blocks={2} />;
  if (testsQuery.isError || !testsQuery.data) {
    return (
      <ErrorState
        title={t("state.error.title")}
        body={t("state.error.body")}
        onRetry={() => void testsQuery.refetch()}
      />
    );
  }

  const tests = testsQuery.data;
  const results = resultsQuery.data ?? [];

  if (activeTest) {
    return (
      <TestRunner
        test={activeTest}
        onExit={() => setActiveTest(null)}
        onSubmit={async (answers, timeSpentSeconds) => {
          const result = await submitTest.mutateAsync({
            testId: activeTest.id,
            answers,
            timeSpentSeconds,
          });
          setLastResult(result);
          setActiveTest(null);
          return result;
        }}
      />
    );
  }

  if (lastResult) {
    return (
      <div className="flex flex-col gap-6">
        <TestResultView result={lastResult} test={tests.find((x) => x.id === lastResult.testId)} />
        <Button variant="ghost" className="w-fit" onClick={() => setLastResult(null)}>
          {t("common.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("tests.title")} subtitle={t("tests.subtitle")} />

      <Tabs defaultValue="available">
        <TabsList
          items={[
            { value: "available", label: t("tests.available"), icon: <ScrollText /> },
            { value: "results", label: t("tests.results") },
          ]}
        />

        <TabsContent value="available">
          {tests.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title={t("tests.empty.title")}
              body={t("tests.empty.body")}
            />
          ) : (
            <ul className="flex flex-col gap-3">
              {tests.map((test) => {
                const submitted = test.status === "submitted";
                return (
                  <li
                    key={test.id}
                    className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold">{test.title}</h2>
                        {submitted && <Badge tone="success">{t("common.completed")}</Badge>}
                      </div>
                      <p className="tabular mt-1 text-xs text-muted-foreground">
                        {t("tests.questions", { count: test.questions.length })} ·{" "}
                        {test.timeLimitMinutes
                          ? t("tests.timeLimit", { minutes: test.timeLimitMinutes })
                          : t("tests.untimed")}
                      </p>
                    </div>
                    <Button
                      variant={submitted ? "secondary" : "primary"}
                      className="shrink-0"
                      disabled={submitted || test.questions.length === 0}
                      onClick={() => setActiveTest(test)}
                    >
                      {submitted ? t("common.completed") : t("tests.start")}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="results">
          {results.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title={t("tests.empty.title")}
              body={t("tests.empty.body")}
            />
          ) : (
            <SectionBlock>
              <ul className="flex flex-col gap-3">
                {results.map((result) => (
                  <li key={`${result.testId}-${result.submittedAt}`}>
                    <button
                      type="button"
                      onClick={() => setLastResult(result)}
                      className="flex w-full items-center gap-4 rounded-lg border border-border bg-surface p-5 text-start transition-colors hover:border-border-strong focus-visible:shadow-focus focus-visible:outline-none"
                    >
                      <span
                        className={
                          result.score >= 80
                            ? "tabular flex size-12 shrink-0 items-center justify-center rounded-full border border-success/40 bg-success-subtle text-sm font-semibold text-success"
                            : result.score >= 65
                              ? "tabular flex size-12 shrink-0 items-center justify-center rounded-full border border-warning/40 bg-warning-subtle text-sm font-semibold text-warning-foreground"
                              : "tabular flex size-12 shrink-0 items-center justify-center rounded-full border border-danger/40 bg-danger-subtle text-sm font-semibold text-danger-foreground"
                        }
                        aria-hidden="true"
                      >
                        {result.score}%
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {tests.find((x) => x.id === result.testId)?.title ?? result.testId}
                        </span>
                        <span className="tabular mt-0.5 block text-xs text-muted-foreground">
                          {t(`tests.recommendation.${result.recommendation}`)} ·{" "}
                          {formatDuration(Math.round(result.timeSpentSeconds / 60))}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </SectionBlock>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
