/**
 * Server-only database access.
 *
 * Nothing under src/lib/server may be imported by client components —
 * the Prisma client holds the connection string and never crosses to
 * the browser. A single connection is reused across hot reloads.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  mureehPrisma?: PrismaClient;
};

function createClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.mureehPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.mureehPrisma = prisma;
}
