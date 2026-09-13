import { cn, clamp } from "@/lib/utils";

export type ProgressTone = "primary" | "success" | "warning" | "danger" | "mastery" | "muted";

const TONE_CLASSES: Record<ProgressTone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  mastery: "bg-mastery",
  muted: "bg-muted-foreground/50",
};

export interface ProgressProps {
  value: number; // 0–100
  tone?: ProgressTone;
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

/** Determinate progress bar with screen-reader semantics. */
export function Progress({ value, tone = "primary", size = "md", label, className }: ProgressProps) {
  const clamped = clamp(Math.round(value), 0, 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn(
        "w-full overflow-hidden rounded-full bg-muted",
        size === "sm" && "h-1",
        size === "md" && "h-1.5",
        size === "lg" && "h-2.5",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", TONE_CLASSES[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
