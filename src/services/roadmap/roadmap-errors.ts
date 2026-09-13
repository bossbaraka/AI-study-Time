/**
 * Typed roadmap errors (§33). Messages carry stable domain codes only —
 * never storage details, stack traces or engine internals. The UI maps
 * codes to localized text in `features/roadmap/lib/errors.ts`.
 */

import type { RoadmapErrorCode } from "@/types/roadmap";

/** Deterministic generation could not produce a valid roadmap. */
export class RoadmapGenerationError extends Error {
  constructor(
    readonly code: RoadmapErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = "RoadmapGenerationError";
  }
}

/** Cross-student access — existence of foreign resources is never leaked. */
export class RoadmapOwnershipError extends Error {
  constructor(
    readonly status: 403 | 404,
    readonly code: "forbidden" | "roadmap_not_found",
  ) {
    super(code);
    this.name = "RoadmapOwnershipError";
  }
}

/** The final quality gate (§18) rejected a generated roadmap. */
export class RoadmapValidationError extends Error {
  constructor(readonly issues: readonly string[]) {
    super(`Roadmap validation failed: ${issues.join("; ")}`);
    this.name = "RoadmapValidationError";
  }
}
