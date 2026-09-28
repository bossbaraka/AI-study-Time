/**
 * Applies `prisma/migrations/*` in order to the database in `DATABASE_URL`.
 *
 * `prisma migrate deploy` is the real deployment path and remains the one to
 * use in CI and production. This runner exists for local and test databases:
 * it applies exactly the same committed SQL files, and keeps Prisma's own
 * `_prisma_migrations` bookkeeping table so the two paths stay compatible.
 *
 * It is deliberately small — it is not a reimplementation of Prisma Migrate,
 * and it must never be used to author migrations.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import pg from "pg";

const MIGRATIONS_DIR = path.resolve("prisma/migrations");
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

function migrationFolders() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((entry) => {
      const full = path.join(MIGRATIONS_DIR, entry);
      return statSync(full).isDirectory() && !entry.startsWith("_");
    })
    .sort();
}

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
        id                  VARCHAR(36)  NOT NULL PRIMARY KEY,
        checksum            VARCHAR(64)  NOT NULL,
        finished_at         TIMESTAMPTZ,
        migration_name      VARCHAR(255) NOT NULL,
        logs                TEXT,
        rolled_back_at      TIMESTAMPTZ,
        started_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
        applied_steps_count INTEGER      NOT NULL DEFAULT 0
      )
    `);

    const applied = new Set(
      (
        await client.query(
          `SELECT migration_name FROM "_prisma_migrations" WHERE rolled_back_at IS NULL`,
        )
      ).rows.map((row) => row.migration_name),
    );

    let count = 0;
    for (const folder of migrationFolders()) {
      if (applied.has(folder)) continue;
      const sql = readFileSync(path.join(MIGRATIONS_DIR, folder, "migration.sql"), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO "_prisma_migrations"
             (id, checksum, migration_name, finished_at, applied_steps_count)
           VALUES (gen_random_uuid()::text, $1, $2, now(), 1)`,
          [folder.slice(0, 64), folder.slice(0, 255)],
        );
        await client.query("COMMIT");
        console.log(`applied ${folder}`);
        count += 1;
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`migration ${folder} failed: ${error.message}`);
      }
    }
    console.log(count === 0 ? "database already up to date" : `${count} migration(s) applied`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
