/**
 * Test environment variables — applied before any test module loads
 * (first entry in `setupFiles` so imports observe it).
 *
 * Prisma in tests must NEVER touch the development database. The gateway
 * and repository integration suites run against a real, DISPOSABLE
 * PostgreSQL database. Start one with:
 *
 *   node scripts/local-postgres.mjs start
 *   DATABASE_URL=$DATABASE_URL_TEST node scripts/apply-migrations.mjs
 *
 * `DATABASE_URL_TEST` is documented in `.env.example`. The default below is
 * the disposable database created by `scripts/local-postgres.mjs`; it always
 * names `mureeh_test`, and the integration suites additionally assert that
 * before deleting anything.
 */

process.env.DATABASE_URL ??=
  process.env.DATABASE_URL_TEST ??
  "postgresql://mureeh:mureeh_local_only@127.0.0.1:55432/mureeh_test";
