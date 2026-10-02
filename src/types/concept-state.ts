/**
 * ConceptState — decomposed learner model.
 *
 * Not a single mastery percentage, but a vector with source-traceable
 * dimensions. Every score has an update rule, a source evidence id, and
 * a timestamp.
 */

export interface ConceptState {
  conceptId: string;
  studentId: string;
  // Decomposed mastery dimensions 0..1
  knowledge: number;
  retrieval: number;
  retention: number;
  transfer: number;
  fluency: number;
  // Meta-cognitive flags 0..1
  confidence: number;
  hintDependency: number;
  misconceptionRisk: number;
  // Provenance
  evidenceCount: number;
  lastEvidenceAt: string | null;
  stateVersion: number;
  updatedAt: string;
  createdAt: string;
}

/**
 * What changed and why — stored alongside the state transition for
 * auditability. Not shown raw to the student, but powers "Why this mission?"
 */
export interface ConceptStateUpdate {
  conceptId: string;
  studentId: string;
  previous: ConceptState | null;
  next: ConceptState;
  evidenceId: string;
  reason: string;
  updatedAt: string;
}

export const CONCEPT_STATE_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "state_not_found",
  "invalid_state",
  "network",
  "unknown",
] as const;

export type ConceptStateErrorCode = (typeof CONCEPT_STATE_ERROR_CODES)[number];
