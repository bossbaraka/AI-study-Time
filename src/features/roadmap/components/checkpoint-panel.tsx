"use client";

import { ShieldCheck } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import type { Checkpoint } from "@/types/roadmap";

export interface CheckpointPanelProps {
  checkpoint: Checkpoint;
}

/**
 * The milestone checkpoint (§11): a capability test with an explicit
 * ready-to-continue signal — never "did you finish?".
 */
export function CheckpointPanel({ checkpoint }: CheckpointPanelProps) {
  const t = useT();

  return (
    <div className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 px-4 py-3.5">
      <p className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
        <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />
        {t("roadmap.checkpoints.label")} · {t(`roadmap.checkpoints.types.${checkpoint.type}`)}
      </p>
      <p className="text-sm font-medium text-foreground">{checkpoint.title}</p>
      <p className="text-xs leading-relaxed text-muted-foreground">{checkpoint.description}</p>
      <p className="text-xs leading-relaxed text-foreground">
        <span className="font-medium">{t("roadmap.checkpoints.readyWhen")}: </span>
        {checkpoint.successSignal}
      </p>
    </div>
  );
}
