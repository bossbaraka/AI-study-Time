/**
 * Server-only database access.
 *
 * Nothing under src/lib/server may be imported by client components — the
 * Prisma client holds the connection string and never crosses to the
 * browser. A single connection is reused across hot reloads.
 *
 * This is the ONLY place a `PrismaClient` is constructed. The client engine
 * type requires an explicit driver adapter, so centralising it here means no
 * call site can accidentally open a second, differently-configured
 * connection.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  mureehPrisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  // Fail explicitly. A missing connection string must never degrade into a
  // silently working in-memory or mock store — a database outage has to look
  // like a database outage.
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. The application requires PostgreSQL; it will not fall back to mock persistence.",
    );
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.mureehPrisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.mureehPrisma = prisma;
}
