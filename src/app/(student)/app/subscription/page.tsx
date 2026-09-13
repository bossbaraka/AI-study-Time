"use client";

import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import {
  useChangeSubscriptionTier,
  useSubscriptionPlans,
} from "@/features/engagement/hooks/use-engagement";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@/types/domain";


export default function SubscriptionPage() {
  const t = useT();
  const plansQuery = useSubscriptionPlans();
  const changeTier = useChangeSubscriptionTier();

  if (plansQuery.isLoading) return <PageSkeleton blocks={2} />;
  if (plansQuery.isError || !plansQuery.data) {
    return (
      <ErrorState
        title={t("state.error.title")}
        body={t("state.error.body")}
        onRetry={() => void plansQuery.refetch()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("subscription.title")} subtitle={t("subscription.subtitle")} />

      <div className="grid gap-4 lg:grid-cols-3">
        {plansQuery.data.map((plan) => (
          <PlanCard
            key={plan.tier}
            plan={plan}
            onSelect={() => changeTier.mutate(plan.tier)}
            selecting={changeTier.isPending}
          />
        ))}
      </div>
    </div>
  );
}

function PlanCard({
  plan,
  onSelect,
  selecting,
}: {
  plan: SubscriptionPlan;
  onSelect: () => void;
  selecting: boolean;
}) {
  const t = useT();

  return (
    <section
      aria-label={t(`subscription.${plan.tier}.name`)}
      className={cn(
        "flex flex-col gap-5 rounded-xl border bg-surface p-6",
        plan.current ? "border-primary/45" : "border-border",
      )}
    >
      <header>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight">
            {t(`subscription.${plan.tier}.name`)}
          </h2>
          {plan.current && <Badge tone="primary">{t("subscription.current")}</Badge>}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t(`subscription.${plan.tier}.desc`)}
        </p>
      </header>

      <p className="tabular text-3xl font-semibold tracking-tight">
        ${plan.monthlyPriceUsd}
        <span className="text-sm font-normal text-muted-foreground">
          {" "}{t("subscription.month")}
        </span>
      </p>

      <ul className="flex flex-1 flex-col gap-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
            <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>

      <Button
        variant={plan.current ? "secondary" : "primary"}
        onClick={onSelect}
        disabled={plan.current || selecting}
      >
        {plan.current ? t("subscription.current") : t(plan.monthlyPriceUsd === 0 ? "subscription.downgrade" : "subscription.upgrade")}
      </Button>
    </section>
  );
}
