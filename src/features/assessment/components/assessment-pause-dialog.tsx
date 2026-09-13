"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useT } from "@/lib/i18n/provider";

export interface AssessmentPauseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionsAnswered: number;
  /** Pause the session server-side and leave the runner. */
  onPauseAndExit: () => void;
  isPausing: boolean;
}

/**
 * Pause confirmation (§15): progress is always preserved server-side;
 * the dialog makes that explicit so exiting never feels destructive.
 */
export function AssessmentPauseDialog({
  open,
  onOpenChange,
  questionsAnswered,
  onPauseAndExit,
  isPausing,
}: AssessmentPauseDialogProps) {
  const t = useT();

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("assessment.pauseTitle")}
      description={`${t("assessment.pauseBody")} ${t("assessment.continueBody", {
        count: questionsAnswered,
      })}`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isPausing}>
            {t("assessment.resumeCta")}
          </Button>
          <Button variant="secondary" onClick={onPauseAndExit} disabled={isPausing}>
            {isPausing && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {t("assessment.pauseExit")}
          </Button>
        </>
      }
    />
  );
}
