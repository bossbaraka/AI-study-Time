/**
 * Test environment variables — applied before any test module loads
 * (first entry in `setupFiles` so imports observe it).
 *
 * Prisma in tests must NEVER touch the development database: the gateway
 * suites get their own pushed SQLite file, prepared by `npm run db:push`
 * with DATABASE_URL pointing here.
 */

import path from "node:path";

process.env.DATABASE_URL ??= `file:${path.resolve(process.cwd(), "prisma/data/test.db")}`;
