"use client";

import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Loader2, PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GoalSummary } from "@/features/goals/components/goal-summary";
import { useI18n, useT } from "@/lib/i18n/provider";
import { formatDate } from "@/lib/utils";
import type { LearningGoal } from "@/types/goal";

export interface LockedGoalViewProps {
  goal: LearningGoal;
  /** Explicit revision — the only way a locked goal becomes editable (§5/§14). */
  onRevise: () => void;
  isRevising: boolean;
}

/**
 * Locked-goal confirmation (§14/§26): the committed goal, restated plainly,
 * with the date it was locked. The locked goal survives refresh (mock
 * storage) and never mutates without an explicit revision flow.
 */
export function LockedGoalView({ goal, onRevise, isRevising }: LockedGoalViewProps) {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col gap-8"
    >
      <header className="flex flex-col items-center gap-3 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="size-6 text-primary" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {t("goals.locked.title")}
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t("goals.locked.body")}
        </p>
      </header>

      <Card>
        <CardContent className="flex flex-col gap-6 p-6">
          <GoalSummary goal={goal} />
          {goal.lockedAt && (
            <p className="border-t border-border pt-4 text-xs text-muted-foreground">
              {t("goals.locked.lockedAt", { date: formatDate(goal.lockedAt, locale) })}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col items-center gap-3">
        <Button size="lg" onClick={() => router.push("/roadmap")}>
          {t("goals.locked.roadmapCta")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
        <Button variant="secondary" onClick={() => router.push("/app")}>
          {t("goals.locked.dashboardCta")}
        </Button>
        <p className="text-xs text-muted-foreground">{t("goals.locked.next")}</p>
        <Button variant="ghost" size="sm" onClick={onRevise} disabled={isRevising}>
          {isRevising ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <PenLine className="size-4" aria-hidden="true" />
          )}
          {t("goals.locked.revise")}
        </Button>
      </div>
    </motion.div>
  );
}
