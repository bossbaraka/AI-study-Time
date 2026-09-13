/**
 * Phase 7 evidence-form validation — Zod schema for the learn screen.
 *
 * Two layers, by design (same convention as goal/auth schemas):
 * - HERE: form-shape validation — both evidence parts are required.
 *   Messages are translation keys resolved by `resolveZodMessage`.
 * - ENGINE: evidence quality evaluation (development evaluator) —
 *   result semantics never live in schemas or components.
 */

import { z } from "zod";

export const evidenceFormSchema = z.object({
  solution: z.string().trim().min(1, "execution.evidence.errors.solutionRequired"),
  reasoning: z.string().trim().min(1, "execution.evidence.errors.reasoningRequired"),
});

export type EvidenceFormValues = z.infer<typeof evidenceFormSchema>;

export const emptyEvidenceFormValues: EvidenceFormValues = {
  solution: "",
  reasoning: "",
};
