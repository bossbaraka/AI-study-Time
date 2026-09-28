/**
 * Domain-error → HTTP mapping (§11, §12).
 *
 * The rule this file exists to protect: a domain error that is already
 * correctly classified must stay correctly classified on its way out. The
 * Phase 1 assessment path lost that — every engine error was funnelled through
 * one wrapper, so a genuine domain refusal and a network failure became the
 * same thing to the caller.
 *
 * So this maps *known* domain errors to a status and preserves their code
 * verbatim, and returns `null` for anything it does not recognise, leaving the
 * caller's generic handling in charge. Nothing here invents a code, and
 * nothing here forwards a message: the UI maps codes to translation keys.
 *
 * The codes are the client's contract — the `errors.ts` module under each feature resolves
 * exactly these strings, so changing one is a breaking API change.
 */

import { ApiError } from "@/lib/api/client";
import {
  RoadmapGenerationError,
  RoadmapOwnershipError,
  RoadmapValidationError,
} from "@/services/roadmap/roadmap-errors";
import { InvalidRoadmapTransitionError } from "@/services/roadmap/roadmap-state-machine";
import {
  EvidenceInvalidError,
  ExecutionConflictError,
  ExecutionNotFoundError,
  ExecutionUnauthorizedError,
  LearningUnitUnavailableError,
} from "@/services/execution/execution-errors";
import { InvalidExecutionTransitionError } from "@/services/execution/execution-state-machine";

export interface MappedError {
  status: number;
  /** The stable domain code the client switches on. Never a message. */
  code: string;
}

/**
 * Translates a recognised domain error. `null` means "not mine" — the caller
 * keeps its own handling rather than this file becoming a catch-all.
 */
export function mapDomainError(error: unknown): MappedError | null {
  /* ---------------------------------------------------------------- */
  /* Roadmap                                                          */
  /* ---------------------------------------------------------------- */

  // Carries its own status: the engine already decided whether a foreign
  // roadmap is a 403 or a 404.
  if (error instanceof RoadmapOwnershipError) {
    return { status: error.status, code: error.code };
  }
  if (error instanceof InvalidRoadmapTransitionError) {
    return { status: 409, code: "invalid_transition" };
  }
  if (error instanceof RoadmapValidationError) {
    // The pre-persist quality gate rejected a generated plan. Nothing was
    // stored, and no client action would fix it — it is a domain verdict.
    return { status: 422, code: "generation_failed" };
  }
  if (error instanceof RoadmapGenerationError) {
    return { status: generationStatus(error.code), code: error.code };
  }

  /* ---------------------------------------------------------------- */
  /* Execution                                                        */
  /* ---------------------------------------------------------------- */

  if (error instanceof ExecutionUnauthorizedError) {
    return { status: error.status, code: error.code };
  }
  if (error instanceof ExecutionNotFoundError) {
    return { status: 404, code: "execution_not_found" };
  }
  if (error instanceof InvalidExecutionTransitionError) {
    return { status: 409, code: "invalid_transition" };
  }
  if (error instanceof LearningUnitUnavailableError) {
    // Honest, non-leaking reason: no active roadmap, roadmap not executable,
    // or prerequisites unpassed. The client shows the reason; it never learns
    // anything about another student's progress.
    return { status: 409, code: "unit_unavailable" };
  }
  if (error instanceof EvidenceInvalidError) {
    return { status: 422, code: "evidence_invalid" };
  }
  if (error instanceof ExecutionConflictError) {
    return { status: 409, code: "conflict" };
  }

  /* ---------------------------------------------------------------- */
  /* Already correctly classified                                     */
  /* ---------------------------------------------------------------- */

  // The goal engine throws `ApiError(code, status, code)` directly. It has
  // done the classification; this passes it through untouched.
  if (error instanceof ApiError) {
    const status = error.status >= 400 && error.status <= 599 ? error.status : 500;
    return { status, code: error.code ?? "unknown" };
  }

  return null;
}

/**
 * Generation failures split by whether the client can do something about it.
 * A locked goal that does not exist yet is a precondition (409); a timeframe
 * the plan cannot fit is the student's input (422); anything else is ours.
 */
function generationStatus(code: string): number {
  if (code === "no_locked_goal") return 409;
  if (code === "infeasible_timeframe") return 422;
  if (code === "forbidden") return 403;
  if (code === "roadmap_not_found") return 404;
  return 422;
}
