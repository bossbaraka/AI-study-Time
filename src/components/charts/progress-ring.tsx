"use client";

import { cn, clamp } from "@/lib/utils";

export interface ProgressRingProps {
  value: number; // 0–100
  size?: number;
  strokeWidth?: number;
  tone?: "primary" | "mastery" | "warning";
  label?: string;
  className?: string;
  children?: React.ReactNode;
}

const TONE_STROKE: Record<NonNullable<ProgressRingProps["tone"]>, string> = {
  primary: "stroke-primary",
  mastery: "stroke-mastery",
  warning: "stroke-warning",
};

/**
 * Determinate ring for goal/phase progress.
 * SVG-only: no chart library weight for a single indicator.
 */
export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 8,
  tone = "primary",
  label,
  className,
  children,
}: ProgressRingProps) {
  const clamped = clamp(value, 0, 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset] duration-700 ease-out", TONE_STROKE[tone])}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {children ?? (
          <span className="tabular text-xl font-semibold">{clamped}%</span>
        )}
      </div>
    </div>
  );
}
