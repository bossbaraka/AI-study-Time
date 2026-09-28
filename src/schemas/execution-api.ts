/**
 * Server-side request schemas for the execution API.
 *
 * One deliberate omission: these schemas bound the LENGTH of evidence but do
 * not require it to be non-empty. Rejecting blank evidence is a DOMAIN rule
 * (`EvidenceInvalidError` → `evidence_invalid`), and the engine owns it. If
 * the boundary rejected empty strings first, the client would see a generic
 * 400 instead of the domain's own code — the Phase 1 error-flattening
 * mistake in a new place.
 *
 * There is also no `status` field. A client cannot mark a unit submitted or
 * evaluated; it can only call `start`, `evidence` and `evaluate`, and the
 * execution state machine decides which of those are legal right now.
 */

import { z } from "zod";

export const evidenceInputSchema = z.object({
  solution: z.string().max(4000),
  reasoning: z.string().max(4000),
});

export const learningUnitIdParamSchema = z.string().trim().min(1).max(64);

export type EvidenceInputPayload = z.infer<typeof evidenceInputSchema>;
