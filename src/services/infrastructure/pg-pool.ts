/**
 * Shared pg Pool — production backing for learning-intelligence stores.
 *
 * Uses DATABASE_URL directly. The Prisma-backed `prisma` client also uses
 * @prisma/adapter-pg with the same connection string, but it is a stub in
 * offline environments. This Pool works regardless of Prisma generation,
 * so the new intelligence tables are usable even when `prisma generate`
 * cannot run.
 *
 * One pool per process, reused across hot reloads via globalThis (same
 * discipline as `lib/server/db.ts`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import pg from "pg";

const globalForPg = globalThis as unknown as { mureehPgPool?: pg.Pool };

function createPool(): pg.Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — PostgreSQL required for intelligence stores.");
  }
  return new pg.Pool({
    connectionString,
    max: 8,
    idleTimeoutMillis: 30_000,
  });
}

export function getPool(): pg.Pool {
  if (!globalForPg.mureehPgPool) {
    globalForPg.mureehPgPool = createPool();
  }
  return globalForPg.mureehPgPool;
}
