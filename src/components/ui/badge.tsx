import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-2xs font-medium [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        primary: "border-primary/30 bg-primary/12 text-primary",
        success: "border-success/30 bg-success-subtle text-success-foreground",
        warning: "border-warning/30 bg-warning-subtle text-warning-foreground",
        danger: "border-danger/30 bg-danger-subtle text-danger-foreground",
        info: "border-info/30 bg-info-subtle text-info-foreground",
        mastery: "border-mastery/40 bg-mastery-subtle text-mastery",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { badgeVariants };
