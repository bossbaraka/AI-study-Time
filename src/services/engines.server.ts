/**
 * Composition root for the SERVER: API route handlers and server components.
 *
 * Same four engines, same domain logic, same ports as `engines.ts` — but the
 * storage behind them is PostgreSQL through Prisma (§5). Production never
 * reaches an in-memory collection: there is no mock fallback here, and no
 * path by which a database outage could quietly degrade into one (§25).
 * `@/lib/server/db` throws at construction if `DATABASE_URL` is missing.
 *
 * **Server-only by construction.** This module imports the Prisma client,
 * which holds the connection string; it must never be reachable from a client
 * component. Only route handlers and server modules import it.
 */

import { prisma } from "@/lib/server/db";
import { composeEngines } from "@/services/engines-core";
import { createPrismaStores } from "@/services/infrastructure/prisma";

export const stores = createPrismaStores(prisma);

const composed = composeEngines(stores, {
  // The assessment engine is in this process. Crossing HTTP to talk to
  // ourselves would add a network hop, a cookie round trip and a failure
  // mode to a call that is a function call away.
  diagnosisViaHttp: false,
});

export const mockAssessmentEngine = composed.assessment;
export const mockGoalEngine = composed.goal;
export const mockRoadmapEngine = composed.roadmap;
export const mockExecutionEngine = composed.execution;
export const assessmentResultSource = composed.assessmentResultSource;

/** Test seam: empties the learning tables. Awaits, because this is I/O. */
export async function resetAllEngines(): Promise<void> {
  await stores.resetAll();
}
