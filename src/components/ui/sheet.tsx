"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./button";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  side?: "start" | "end" | "bottom";
}

/**
 * Drawer/sheet used for the mobile navigation and detail panels.
 * Slides from the inline-start edge (RTL-aware) or from the bottom.
 */
export function Sheet({ open, onOpenChange, title, children, side = "start" }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (typeof document === "undefined") return null;

  const isBottom = side === "bottom";
  const initial = isBottom
    ? { y: "100%" }
    : side === "end"
      ? { x: "100%" }
      : { x: "-100%" };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => onOpenChange(false)}
            aria-hidden="true"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={initial}
            animate={isBottom ? { y: 0 } : { x: 0 }}
            exit={initial}
            transition={{ type: "tween", duration: 0.24, ease: "easeOut" }}
            className={
              isBottom
                ? "absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-xl border-t border-border bg-surface-overlay shadow-lg"
                : side === "end"
                  ? "absolute inset-y-0 end-0 flex w-[85vw] max-w-sm flex-col border-s border-border bg-surface-overlay shadow-lg"
                  : "absolute inset-y-0 start-0 flex w-[85vw] max-w-sm flex-col border-e border-border bg-surface-overlay shadow-lg"
            }
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">{title}</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                aria-label="Close panel"
              >
                <X />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
