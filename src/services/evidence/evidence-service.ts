/**
 * Evidence service — validated, student-owned, traceable.
 *
 * Server-side only knowledge of evidence truth. Not a dump of
 * client-provided correctness; evidence is persisted with the score
 * the server computed (for assessment/execution/tests) or with explicit
 * validation for free-form evidence.
 */

import { ApiError } from "@/lib/api/client";
import type { EvidenceStore, LearningEventStore } from "@/services/ports/learning-ports";
import type { ConceptStateStore } from "@/services/ports/learning-ports";
import type { CreateEvidenceInput } from "@/types/evidence";
import { EVIDENCE_KINDS } from "@/types/evidence";
import { masteryEngine } from "@/services/mastery/mastery-engine";

const VALID_KINDS = new Set<string>(EVIDENCE_KINDS as unknown as string[]);

export function createEvidenceService(
  evidenceStore: EvidenceStore,
  eventStore: LearningEventStore,
  conceptStateStore: ConceptStateStore,
) {
  return {
    async submit(studentId: string, input: CreateEvidenceInput) {
      if (!studentId) throw new ApiError("invalid_evidence", 400, "invalid_evidence");
      if (!VALID_KINDS.has(input.kind)) throw new ApiError("invalid_evidence", 400, "invalid_evidence");
      if (!input.payload || typeof input.payload !== "object") throw new ApiError("invalid_evidence", 400, "invalid_evidence");
      // payload must not be empty
      if (Object.keys(input.payload).length === 0) throw new ApiError("invalid_evidence", 400, "invalid_evidence");
      if (input.score !== undefined && input.score !== null) {
        if (typeof input.score !== "number" || input.score < 0 || input.score > 1) throw new ApiError("invalid_evidence", 400, "invalid_evidence");
      }

      const evidence = await evidenceStore.create(studentId, input);

      // Emit learning event
      await eventStore.append({
        studentId,
        type: "EVIDENCE_SUBMITTED",
        source: "api",
        entityType: "Evidence",
        entityId: evidence.id,
        payload: { evidenceId: evidence.id, conceptId: evidence.conceptId, kind: evidence.kind, score: evidence.score },
      }).catch(() => { /* event append is best-effort for this path; mastery update is primary */ });

      // Update ConceptState if concept-linked
      if (evidence.conceptId) {
        const prev = await conceptStateStore.get(studentId, evidence.conceptId);
        const { next } = masteryEngine.apply(evidence, prev ?? null);
        const stateToStore = {
          ...next,
          // Ensure ConceptState has id for pg upsert
          id: (prev as unknown as { id?: string })?.id ?? `cs_${studentId}_${evidence.conceptId}`.slice(0, 60),
        } as unknown as import("@/types/concept-state").ConceptState & { id: string };
        await conceptStateStore.upsert(stateToStore as unknown as import("@/types/concept-state").ConceptState);
      }

      return evidence;
    },

    async listForStudent(studentId: string, limit = 50) {
      return evidenceStore.listByStudent(studentId, limit);
    },

    async listForConcept(studentId: string, conceptId: string) {
      return evidenceStore.listByConcept(studentId, conceptId);
    },
  };
}
