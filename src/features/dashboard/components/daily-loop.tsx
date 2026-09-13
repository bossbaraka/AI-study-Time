"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { PendingDot } from "@/components/feedback/status-indicator";
import type { DailyStep } from "@/types/domain";

const STEP_ICONS = {
  learn: "01",
  practice: "02",
  recall: "03",
  quiz: "04",
} as const;

/**
 * Today's Journey — the daily execution loop:
 * Learn → Practice → Active Recall → Quiz.
 * State is communicated with icon + color + label, never color alone.
 */
export function DailyLoop({ steps }: { steps: DailyStep[] }) {
  const t = useT();

  return (
    <ol className="flex flex-col gap-0" aria-label={t("dashboard.todaysJourney")}>
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.step} className="flex items-stretch gap-3">
            {/* Connector column */}
            <div className="flex flex-col items-center">
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.06, duration: 0.25 }}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border text-2xs font-semibold",
                  step.state === "done" &&
                    "border-success/40 bg-success-subtle text-success-foreground",
                  step.state === "active" &&
                    "border-primary bg-primary text-primary-foreground shadow-xs",
                  step.state === "pending" && "border-border bg-surface text-muted-foreground",
                )}
                aria-hidden="true"
              >
                {step.state === "done" ? (
                  <Check className="size-4" />
                ) : (
                  STEP_ICONS[step.step]
                )}
              </motion.span>
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "w-px flex-1",
                    step.state === "done" ? "bg-success/40" : "bg-border",
                  )}
                />
              )}
            </div>

            {/* Label row */}
            <div
              className={cn(
                "flex min-h-12 flex-1 items-center gap-2 pb-4",
                step.state === "pending" && "text-muted-foreground",
              )}
            >
              <span className="text-sm font-medium">{t(`dashboard.step.${step.step}`)}</span>
              {step.state === "active" && (
                <span className="flex items-center gap-1 text-xs font-medium text-primary">
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                  {t("common.today")}
                </span>
              )}
              {step.state === "pending" && <PendingDot className="ms-auto" />}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
