import { cn } from "@/lib/utils";

export interface AvatarProps {
  initials: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** Initials avatar — no remote images needed, consistent across the product. */
export function Avatar({ initials, size = "md", className }: AvatarProps) {
  return (
    <span
      role="img"
      aria-label={initials}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/12 font-semibold text-primary select-none",
        size === "sm" && "size-7 text-2xs",
        size === "md" && "size-9 text-xs",
        size === "lg" && "size-12 text-sm",
        className,
      )}
    >
      {initials}
    </span>
  );
}
