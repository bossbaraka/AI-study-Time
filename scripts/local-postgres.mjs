/**
 * Local PostgreSQL for development and integration tests.
 *
 * Prisma's engine binaries cannot be fetched in some sandboxes and many CI
 * runners have no database service, so the repository ships a real
 * PostgreSQL that is unpacked from npm rather than requiring a system
 * install. This is a DISPOSABLE database: the data directory lives under
 * `.pgdata/` (git-ignored) and can be deleted at any time.
 *
 * Usage:
 *   node scripts/local-postgres.mjs start   # start + create both databases
 *   node scripts/local-postgres.mjs stop
 */

import { rmSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const DATA_DIR = path.resolve(".pgdata/data");
const PORT = Number(process.env.PGPORT ?? 55432);
const USER = "mureeh";
const PASSWORD = "mureeh_local_only";
export const DEV_DATABASE = "mureeh_dev";
export const TEST_DATABASE = "mureeh_test";

function connectionString(database) {
  return `postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${database}`;
}

async function start() {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
    postgresOptions: { "-k": "/tmp" },
  });
  await pg.initialise();
  await pg.start();
  for (const db of [DEV_DATABASE, TEST_DATABASE]) {
    try {
      await pg.createDatabase(db);
    } catch {
      /* already exists on a restart */
    }
  }
  console.log(`PostgreSQL listening on 127.0.0.1:${PORT}`);
  console.log(`  dev : ${connectionString(DEV_DATABASE)}`);
  console.log(`  test: ${connectionString(TEST_DATABASE)}`);
  // Keep the process alive so the server survives this script.
  setInterval(() => {}, 1 << 30);
}

async function main() {
  const command = process.argv[2] ?? "start";
  if (command === "reset") {
    rmSync(DATA_DIR, { recursive: true, force: true });
    console.log("removed", DATA_DIR);
    return;
  }
  await start();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
