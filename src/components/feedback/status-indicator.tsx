import {
  Check,
  CircleDashed,
  Lock,
  Play,
  RotateCcw,
  TimerOff,
  TriangleAlert,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PhaseStatus } from "@/constants/journey";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/provider";

/**
 * Status indicators for journey/phase/module states.
 * One visual language across roadmap, mastery, tests and notifications:
 * color + icon + label always travel together (never color alone).
 */

type BadgeTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "mastery";

const STATUS_STYLES: Record<
  PhaseStatus,
  { dot: string; text: string; icon: typeof Check; badgeTone: BadgeTone }
> = {
  locked: { dot: "bg-muted-foreground/40", text: "text-muted-foreground", icon: Lock, badgeTone: "neutral" },
  current: { dot: "bg-primary", text: "text-primary", icon: Play, badgeTone: "primary" },
  completed: { dot: "bg-success", text: "text-success-foreground", icon: Check, badgeTone: "success" },
  delayed: { dot: "bg-warning", text: "text-warning-foreground", icon: TimerOff, badgeTone: "warning" },
  failed: { dot: "bg-danger", text: "text-danger-foreground", icon: TriangleAlert, badgeTone: "danger" },
  recovery: { dot: "bg-info", text: "text-info-foreground", icon: RotateCcw, badgeTone: "info" },
  mastered: { dot: "bg-mastery", text: "text-mastery", icon: Award, badgeTone: "mastery" },
};

export function StatusDot({ status, className }: { status: PhaseStatus; className?: string }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2.5 rounded-full",
        style.dot,
        status === "current" && "ring-4 ring-primary/20",
        className,
      )}
    />
  );
}

export function StatusIcon({ status, className }: { status: PhaseStatus; className?: string }) {
  const Icon = STATUS_STYLES[status].icon;
  return <Icon className={cn("size-4", STATUS_STYLES[status].text, className)} aria-hidden="true" />;
}

export function StatusBadge({ status }: { status: PhaseStatus }) {
  const t = useT();
  const style = STATUS_STYLES[status];
  return (
    <Badge tone={style.badgeTone}>
      <style.icon aria-hidden="true" />
      {t(`roadmap.status.${status}`)}
    </Badge>
  );
}

export function InactiveStatusBadge({ status }: { status: PhaseStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", style.text)}>
      <style.icon className="size-3.5" aria-hidden="true" />
    </span>
  );
}

/** Non-journey pending marker used in daily loop lists. */
export function PendingDot({ className }: { className?: string }) {
  return (
    <CircleDashed className={cn("size-4 text-muted-foreground/60", className)} aria-hidden="true" />
  );
}
