/**
 * Concept domain — the ontology of what is learned.
 *
 * A Concept is global (not per-student). A LearningUnit teaches a Concept;
 * Evidence proves something about a Concept; ConceptState tracks mastery of
 * a Concept for one student. This separation is deliberate:
 *   LearningUnit = what the student DOES
 *   Concept      = what the student LEARNS
 *   Evidence     = what the student PROVED
 */

export interface Concept {
  id: string;
  name: string;
  description: string;
  domain: string; // javascript | frontend | backend | ...
  prerequisites: string[]; // concept ids
  difficulty: number; // 1..5
  version: number;
  createdAt: string;
  updatedAt: string;
}

export const CONCEPT_ERROR_CODES = [
  "unauthenticated",
  "forbidden",
  "concept_not_found",
  "invalid_input",
  "network",
  "unknown",
] as const;

export type ConceptErrorCode = (typeof CONCEPT_ERROR_CODES)[number];

export function isConceptErrorCode(code: string | undefined): code is ConceptErrorCode {
  return code !== undefined && (CONCEPT_ERROR_CODES as readonly string[]).includes(code);
}
