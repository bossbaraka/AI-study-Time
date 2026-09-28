/**
 * Test environment variables — applied before any test module loads
 * (first entry in `setupFiles` so imports observe it).
 *
 * Prisma in tests must NEVER touch the development database. The
 * gateway integration suite runs against a real, DISPOSABLE PostgreSQL
 * database, prepared by:
 *
 *   DATABASE_URL=$DATABASE_URL_TEST npx prisma db push
 *
 * `DATABASE_URL_TEST` is documented in `.env.example`. The default below
 * targets a local throwaway database so the suite fails loudly (cannot
 * connect) rather than silently pointing at production data.
 */

process.env.DATABASE_URL ??=
  process.env.DATABASE_URL_TEST ??
  "postgresql://postgres:postgres@localhost:5432/mureeh_test";
