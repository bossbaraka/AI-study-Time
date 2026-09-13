"use client";

import { ArrowRight, Compass, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TOPIC_KEY_PREFIX } from "@/features/assessment/constants/assessment.constants";
import { useT } from "@/lib/i18n/provider";
import type { AssessmentResult } from "@/types/assessment";

export interface DiagnosisIntroProps {
  diagnosis: AssessmentResult | null;
  diagnosisLoading: boolean;
  onStart: () => void;
}

function TopicChips({ topics }: { topics: AssessmentResult["strengths"] }) {
  const t = useT();
  if (topics.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {topics.map((insight) => (
        <li
          key={insight.topic}
          className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-foreground"
        >
          {t(`${TOPIC_KEY_PREFIX}${insight.topic}`)}
        </li>
      ))}
    </ul>
  );
}

/**
 * Goal-discovery entry (§6): acknowledges the diagnosis before asking
 * anything. The student sees that Mureeh knows where they stand — then
 * decides to turn that understanding into a goal.
 */
export function DiagnosisIntro({ diagnosis, diagnosisLoading, onStart }: DiagnosisIntroProps) {
  const t = useT();

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="micro-label flex items-center gap-1.5">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {t("goals.intro.kicker")}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t("goals.intro.title")}</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          {t("goals.intro.body")}
        </p>
      </header>

      <section aria-label={t("goals.intro.diagnosisTitle")} className="flex flex-col gap-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <Compass className="size-4 text-primary" aria-hidden="true" />
          {t("goals.intro.diagnosisTitle")}
        </h2>

        {diagnosisLoading ? (
          <div className="flex flex-col gap-2" role="status" aria-label={t("common.loading")}>
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : diagnosis ? (
          <Card>
            <CardContent className="flex flex-col gap-4 p-5">
              {diagnosis.strengths.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("assessment.strengths")}
                  </p>
                  <TopicChips topics={diagnosis.strengths} />
                </div>
              )}
              {diagnosis.developingAreas.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("assessment.developing")}
                  </p>
                  <TopicChips topics={diagnosis.developingAreas} />
                </div>
              )}
              {diagnosis.knowledgeGaps.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("assessment.needsAttention")}
                  </p>
                  <TopicChips topics={diagnosis.knowledgeGaps} />
                </div>
              )}
              {diagnosis.recommendedStartingPoint && (
                <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                  {t("assessment.recommendedStarting")}:{" "}
                  <span className="font-medium text-foreground">
                    {t(`${TOPIC_KEY_PREFIX}${diagnosis.recommendedStartingPoint.topic}`)}
                  </span>{" "}
                  · {t(`assessment.levels.${diagnosis.recommendedStartingPoint.level}`)}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-3 p-5">
              <p className="text-sm text-muted-foreground">{t("goals.intro.noDiagnosis")}</p>
              <div>
                <Link
                  href="/assessment"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {t("goals.intro.assessmentCta")}
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <div>
        <Button size="lg" className="w-fit" onClick={onStart}>
          {t("goals.intro.startCta")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
