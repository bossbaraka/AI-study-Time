"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarRange, Lock, Target } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ProgressRing } from "@/components/charts/progress-ring";
import { TextAreaField } from "@/components/ui/textarea";
import { ErrorState } from "@/components/feedback/states";
import { PageHeader } from "@/components/layout/page-header";
import { useGoal, useRequestGoalChange } from "@/features/journey/hooks/use-journey";
import { useT } from "@/lib/i18n/provider";
import { formatDate, formatDuration } from "@/lib/utils";


const changeSchema = z.object({
  reason: z.string().min(10, "auth.errors.required"),
});

type ChangeValues = z.infer<typeof changeSchema>;

/**
 * My Goal — the locked destination. Progress ring, commitment,
 * target date, and a deliberate (frictional by design) change-request flow.
 */
export default function GoalPage() {
  const t = useT();
  const goalQuery = useGoal();
  const requestChange = useRequestGoalChange();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ChangeValues>({ resolver: zodResolver(changeSchema) });

  if (goalQuery.isLoading) return <PageSkeleton blocks={1} />;
  if (goalQuery.isError || !goalQuery.data) {
    return (
      <ErrorState
        title={t("state.error.title")}
        body={t("state.error.body")}
        onRetry={() => void goalQuery.refetch()}
      />
    );
  }

  const goal = goalQuery.data;

  const onSubmitChange = handleSubmit(async (values) => {
    await requestChange.mutateAsync(values.reason);
    setRequestSent(true);
    reset();
  });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t("goal.title")}
        actions={
          goal.locked ? (
            <Badge tone="success">
              <Lock className="size-3" aria-hidden="true" />
              {t("goal.locked.title")}
            </Badge>
          ) : undefined
        }
      />

      <section className="rounded-xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center">
          <ProgressRing value={goal.overallProgress} size={140} label={t("goal.progress")}>
            <span className="tabular text-3xl font-semibold">{goal.overallProgress}%</span>
            <span className="text-2xs text-muted-foreground">{t("goal.progress")}</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <span className="flex size-10 items-center justify-center rounded-md border border-primary/25 bg-primary/10 text-primary">
              <Target className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">{goal.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {goal.description}
            </p>
          </div>
        </div>

        <dl className="mt-8 grid gap-4 border-t border-border pt-6 sm:grid-cols-3">
          <div>
            <dt className="micro-label">{t("goal.commitment")}</dt>
            <dd className="mt-1.5 text-sm font-semibold">
              {t("goal.commitmentValue", { hours: goal.weeklyCommitmentHours })}
            </dd>
          </div>
          <div>
            <dt className="micro-label flex items-center gap-1.5">
              <CalendarRange className="size-3.5" aria-hidden="true" />
              {t("goal.targetDate")}
            </dt>
            <dd className="tabular mt-1.5 text-sm font-semibold">
              {goal.targetDate ? formatDate(goal.targetDate) : "—"}
            </dd>
          </div>
          <div>
            <dt className="micro-label">{t("goal.locked.title")}</dt>
            <dd className="mt-1.5 text-sm font-semibold">
              {goal.lockedAt ? formatDate(goal.lockedAt) : "—"}
            </dd>
          </div>
        </dl>
      </section>

      {/* Lock explanation + deliberate change path */}
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t("goal.locked.body")}
          </p>
        </div>
        <Button variant="outline" className="shrink-0" onClick={() => setDialogOpen(true)}>
          {t("goal.changeRequest")}
        </Button>
      </section>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setRequestSent(false);
        }}
        title={t("goal.changeDialog.title")}
        description={t("goal.changeDialog.body")}
        footer={
          requestSent ? (
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              {t("common.close")}
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={() => void onSubmitChange()} disabled={requestChange.isPending}>
                {t("goal.changeDialog.submit")}
              </Button>
            </>
          )
        }
      >
        {requestSent ? (
          <p role="status" className="rounded-md border border-success/30 bg-success-subtle px-3 py-2.5 text-sm text-success-foreground">
            {t("goal.changeDialog.success")}
          </p>
        ) : (
          <TextAreaField
            label={t("goal.changeDialog.reason")}
            placeholder={t("goal.changeDialog.placeholder")}
            rows={4}
            error={errors.reason ? t("auth.errors.required") : null}
            {...register("reason")}
          />
        )}
      </Dialog>

      <p className="text-xs text-muted-foreground">
        {t("goal.progress")}: {goal.overallProgress}% ·{" "}
        {formatDuration(goal.weeklyCommitmentHours * 60)} {t("common.hours")} / {t("common.weeks")}
      </p>
    </div>
  );
}
