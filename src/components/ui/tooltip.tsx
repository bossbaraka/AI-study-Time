"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}

/**
 * Lightweight tooltip: shows on hover and keyboard focus.
 * Content is also exposed via aria-describedby for screen readers.
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <span
      className={cn("relative inline-flex", className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      aria-describedby={id}
    >
      {children}
      <span id={id} role="tooltip" className="sr-only">
        {content}
      </span>
      {visible && (
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute start-1/2 z-40 w-max max-w-56 -translate-x-1/2 rounded-md border border-border bg-surface-overlay px-2.5 py-1.5 text-xs text-foreground shadow-md animate-fade-in",
            side === "top" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
