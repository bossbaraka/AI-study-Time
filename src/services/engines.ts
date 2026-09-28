/**
 * Composition root for the BROWSER mock runtime and for tests.
 *
 *   - server-side test / Node  → in-memory collections
 *   - browser / jsdom          → localStorage (the client mock runtime)
 *
 * **This module must stay importable from client components.** It therefore
 * never touches Prisma: `PrismaClient` holds the connection string and cannot
 * cross into a browser bundle. API routes and SSR use `engines.server.ts`,
 * which wires the same engines to PostgreSQL.
 *
 * Adapters are chosen by runtime, not by the domain. Names keep the historical
 * `mock*` prefix so existing import sites changed path only, never
 * identifiers — the engines themselves are the real domain orchestrators, and
 * only their STORAGE is mock here.
 */

import { composeEngines } from "@/services/engines-core";
import { createStores, type StoreBackend } from "@/services/infrastructure";

/** Server-side rendering and API routes have no `window`. */
const backend: StoreBackend = typeof window === "undefined" ? "memory" : "localStorage";

export const stores = createStores(backend);

const composed = composeEngines(stores, {
  // Under Vitest the assessment engine runs in-process even in jsdom, so the
  // source reads it directly. In a real browser the diagnosis is served by an
  // API route, because evaluation is server-authoritative.
  diagnosisViaHttp: typeof window !== "undefined" && !process.env.VITEST,
});

export const mockAssessmentEngine = composed.assessment;
export const mockGoalEngine = composed.goal;
export const mockRoadmapEngine = composed.roadmap;
export const mockExecutionEngine = composed.execution;
export const assessmentResultSource = composed.assessmentResultSource;

/** Test seam: clears every engine's persisted state in one call. */
export function resetAllEngines(): void {
  stores.resetAll();
}
