"use client";

import { motion } from "framer-motion";
import { ArrowRight, Clock3, Gauge, Play } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import { formatDuration } from "@/lib/utils";
import type { Mission } from "@/types/domain";

/**
 * The hero of the dashboard: CURRENT MISSION.
 * One topic, one objective, one action. Nothing else competes with it.
 */
export function CurrentMissionCard({ mission }: { mission: Mission }) {
  const t = useT();
  const inProgress = mission.state === "in-progress" || mission.state === "paused";

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      aria-labelledby="current-mission-heading"
      className="relative overflow-hidden rounded-xl border border-primary/25 bg-surface shadow-sm"
    >
      {/* Quiet depth cue — a single accent edge, no gradients */}
      <div className="absolute inset-y-0 start-0 w-1 bg-primary" aria-hidden="true" />

      <div className="flex flex-col gap-6 p-6 ps-7 sm:p-8 sm:ps-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p id="current-mission-heading" className="micro-label">
            {t("dashboard.mission.label")}
          </p>
          <Badge tone="neutral">{mission.phaseTitle}</Badge>
        </div>

        <div>
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            <span className="text-muted-foreground">{t("dashboard.mission.learn")} </span>
            {mission.topic}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {mission.objective}
          </p>
        </div>

        <dl className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div className="flex items-center gap-2">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" aria-hidden="true" />
              {t("dashboard.mission.estimatedTime")}
            </dt>
            <dd className="tabular text-sm font-semibold">
              {formatDuration(mission.estimatedMinutes)}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Gauge className="size-3.5" aria-hidden="true" />
              {t("dashboard.mission.difficulty")}
            </dt>
            <dd className="text-sm font-semibold">
              {t(`difficulty.${mission.difficulty}`)}
            </dd>
          </div>
        </dl>

        <div>
          <Link href="/app/mission">
            <Button size="lg">
              {inProgress ? (
                <>
                  <Play className="size-4" aria-hidden="true" />
                  {t("dashboard.mission.resume")}
                </>
              ) : (
                t("dashboard.mission.start")
              )}
              <ArrowRight className="size-4 rtl:hidden" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>
    </motion.section>
  );
}
