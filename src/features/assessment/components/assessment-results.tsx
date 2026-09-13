"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Compass, Sprout } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/feedback/states";
import { PageSkeleton } from "@/components/ui/skeleton";
import {
  INSIGHT_KEY_PREFIX,
  TOPIC_KEY_PREFIX,
  ASSESSMENT_ROUTES,
} from "@/features/assessment/constants/assessment.constants";
import {
  useAssessmentResults,
  useAssessmentSession,
} from "@/features/assessment/hooks/use-assessment";
import { normalizeAssessmentError } from "@/features/assessment/lib/errors";
import { useT } from "@/lib/i18n/provider";
import type { LearningInsight } from "@/types/assessment";

interface InsightSectionProps {
  title: string;
  icon: LucideIcon;
  insights: LearningInsight[];
}

function InsightSection({ title, icon: Icon, insights }: InsightSectionProps) {
  const t = useT();
  if (insights.length === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
        <Icon className="size-4 text-primary" aria-hidden="true" />
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {insights.map((insight) => (
          <li key={insight.topic}>
            <Card>
              <CardContent className="flex flex-col gap-1 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium text-foreground">
                    {t(`${TOPIC_KEY_PREFIX}${insight.topic}`)}
                  </p>
                  <p className="shrink-0 text-xs text-muted-foreground">
                    {t("assessment.basedOn", { count: insight.basedOnResponses })}
                  </p>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {t(`${INSIGHT_KEY_PREFIX}${insight.insight}`)}
                </p>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Diagnostic summary (§21). Educational, non-judgmental language only:
 * strengths / developing / needs-attention — never pass/fail, never a
 * bare percentage. The Continue CTA is the STEP 5 hand-off point;
 * Goal Discovery itself is intentionally not implemented here.
 */
export function AssessmentResults({ sessionId }: { sessionId: string }) {
  const t = useT();
  const router = useRouter();
  const resultsQuery = useAssessmentResults(sessionId);
  const sessionQuery = useAssessmentSession(sessionId);

  if (resultsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <p role="status" className="text-sm text-muted-foreground">
          {t("assessment.resultsLoading")}
        </p>
        <PageSkeleton blocks={2} />
      </div>
    );
  }

  if (resultsQuery.isError) {
    const normalized = normalizeAssessmentError(resultsQuery.error);
    if (normalized.code === "assessment_not_completed") {
      const session = sessionQuery.data;
      return (
        <ErrorState
          title={t("assessment.errors.resultsNotReady")}
          body={t("assessment.notStartedBody")}
          action={
            session && (session.status === "in_progress" || session.status === "paused") ? (
              <Button
                variant="secondary"
                onClick={() => router.replace(ASSESSMENT_ROUTES.session(sessionId))}
              >
                {t("assessment.continueCta")}
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => router.replace(ASSESSMENT_ROUTES.intro)}>
                {t("assessment.backToStart")}
              </Button>
            )
          }
        />
      );
    }
    return (
      <ErrorState
        title={t("assessment.errors.resultsUnavailable")}
        body={t(normalized.messageKey)}
        onRetry={normalized.retryable ? () => void resultsQuery.refetch() : undefined}
        action={
          <Button variant="secondary" onClick={() => router.replace(ASSESSMENT_ROUTES.intro)}>
            {t("assessment.backToStart")}
          </Button>
        }
      />
    );
  }

  const result = resultsQuery.data;
  if (!result) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col gap-8"
    >
      <header className="flex flex-col gap-3">
        <p className="micro-label flex items-center gap-2">
          <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
          {t("assessment.resultsTitle")}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{t("assessment.resultsBody")}</h1>
      </header>

      <div className="flex flex-col gap-8">
        <InsightSection
          title={t("assessment.strengths")}
          icon={CheckCircle2}
          insights={result.strengths}
        />
        <InsightSection
          title={t("assessment.developing")}
          icon={Sprout}
          insights={result.developingAreas}
        />
        <InsightSection
          title={t("assessment.needsAttention")}
          icon={Compass}
          insights={result.knowledgeGaps}
        />
      </div>

      <Card className="bg-surface-raised">
        <CardContent className="flex flex-col gap-2 p-5">
          <h2 className="text-sm font-semibold tracking-tight">
            {t("assessment.recommendedStarting")}
          </h2>
          {result.recommendedStartingPoint ? (
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className="text-lg font-semibold text-foreground">
                {t(`${TOPIC_KEY_PREFIX}${result.recommendedStartingPoint.topic}`)}
              </p>
              <p className="text-sm text-muted-foreground">
                {t(`assessment.levels.${result.recommendedStartingPoint.level}`)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("assessment.noRecommendation")}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {t(`assessment.confidence.${result.confidence}`)}
          </p>
        </CardContent>
      </Card>

      <section aria-label={t("assessment.whatNext")} className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{t("assessment.whatNext")}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t("assessment.whatNextBody")}
        </p>
      </section>

      <div>
        <Button size="lg" onClick={() => router.push(ASSESSMENT_ROUTES.goalDiscovery)}>
          {t("assessment.continueToGoals")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </motion.div>
  );
}
