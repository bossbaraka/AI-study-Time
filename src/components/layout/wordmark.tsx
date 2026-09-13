import { cn } from "@/lib/utils";

/**
 * The Mureeh dove mark — an inline SVG echo of the brand emblem:
 * crescent, two swept wings, head and beak, and the orbiting swoosh
 * with its node dots. Single color (currentColor), no gradients, so it
 * sits calmly on paper and on navy alike.
 */
export function DoveMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      fill="currentColor"
      className={cn("size-7 shrink-0 text-primary", className)}
    >
      {/* Crescent above the wings */}
      <path
        d="M23.9 2.2a3.7 3.7 0 1 0 4.3 5.2 3 3 0 1 1-4.3-5.2Z"
        opacity="0.75"
      />
      {/* Rear wing — the long sweep */}
      <path
        d="M2.8 18.4C5 11 10 5.6 15.8 3.6c-3.2 4-5.5 8-6.7 12-1.5 1-3.6 2-6.3 2.8Z"
        opacity="0.5"
      />
      {/* Front wing */}
      <path
        d="M7.9 20.4C9.6 15.1 13 11 17.4 9c-2.3 3.2-4 6.2-4.9 9.2-1.1.9-2.6 1.7-4.6 2.2Z"
        opacity="0.8"
      />
      {/* Body, head and beak */}
      <path d="M15.6 12.2c2.8-2.4 6.4-2.5 8.7-.2l3.6.9-3 1.9c-.9 3.8-5.2 6-9 4.7-1.9-.7-3-2.3-2.7-4 .2-1.3 1-2.5 2.4-3.3Z" />
      {/* Orbiting swoosh with journey nodes */}
      <path
        d="M5.6 24.4c5.4 3.4 13.8 2.6 19.4-2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.45"
      />
      <circle cx="5.4" cy="24.5" r="1.8" opacity="0.9" />
      <circle cx="25.3" cy="22" r="1.3" opacity="0.7" />
    </svg>
  );
}

/**
 * Mureeh wordmark: the dove plus the bilingual brand lockup
 * (مُريح in the display face, MUREEH as the quiet Latin caption).
 * `tone="onDark"` for navy official bands.
 */
export function Wordmark({
  compact = false,
  tone = "default",
  className,
}: {
  compact?: boolean;
  tone?: "default" | "onDark";
  className?: string;
}) {
  const onDark = tone === "onDark";
  return (
    <span
      className={cn(
        "inline-flex select-none items-center gap-2.5",
        onDark ? "text-white" : "text-foreground",
        className,
      )}
    >
      <DoveMark className={onDark ? "size-7 text-white" : "size-7"} />
      {!compact && (
        <span className="flex items-baseline gap-2">
          <span
            lang="ar"
            className="font-display text-lg font-bold leading-none"
          >
            مُريح
          </span>
          <span
            className={cn(
              "hidden text-[9px] font-semibold uppercase leading-none tracking-[0.3em] sm:inline",
              onDark ? "text-white/60" : "text-muted-foreground",
            )}
          >
            Mureeh
          </span>
        </span>
      )}
    </span>
  );
}
