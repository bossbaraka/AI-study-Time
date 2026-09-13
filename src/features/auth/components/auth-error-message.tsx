"use client";

import { TriangleAlert } from "lucide-react";
import { motion } from "framer-motion";
import { useT } from "@/lib/i18n/provider";
import { normalizeAuthError } from "@/features/auth/lib/errors";

/**
 * Single error surface for all auth operations.
 * Accepts the raw error, normalizes it internally — components never
 * render backend messages, stack traces or codes directly.
 * `role="alert"` makes state changes screen-reader announced.
 */
export function AuthErrorMessage({ error }: { error: unknown }) {
  const t = useT();
  if (error === null || error === undefined) return null;

  const normalized = normalizeAuthError(error);

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-2.5 rounded-md border border-danger/30 bg-danger-subtle px-3.5 py-3"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
      <p className="text-sm leading-relaxed text-danger-foreground">{t(normalized.messageKey)}</p>
    </motion.div>
  );
}
