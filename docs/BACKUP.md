# Backup & Recovery — Operations

## RPO / RTO (provider-dependent — set with your Postgres provider)

| Objective | Target | Notes |
|---|---|---|
| **RPO** (data loss) | ≤ 1 hour | Provider PITR (point-in-time recovery) must be enabled; else `pg_dump` hourly cron → object storage. |
| **RTO** (restore) | ≤ 1 hour | Single `prisma migrate deploy` + data restore + `next start`. |
| **Retention** | 7 daily + 4 weekly | Provider default 7 days; extend if needed. |
| **Encryption** | At rest + in transit | Verify provider setting; don’t claim until checked. |

Without provider PITR, RPO is the interval of your `pg_dump` schedule — be honest in your runbook.

---

## Backup Frequency

- **Provider-managed:** Continuous WAL archiving if enabled — verify in provider dashboard (Neon, Supabase, Render Postgres have different defaults).
- **Self-hosted / fallback:** `pg_dump --format=custom --file=backup.dump $DATABASE_URL` hourly via cron, upload to S3/R2, lifecycle 30 days.

## Restore Process

### Full restore (new database)

1. Create empty DB, set `DATABASE_URL` to it.
2. Restore dump: `pg_restore --clean --if-exists --dbname=$DATABASE_URL backup.dump` OR provider “restore to new branch” button.
3. Verify `_prisma_migrations` exists; if not, `node scripts/apply-migrations.mjs` (or `npx prisma migrate deploy`).
4. `npm run build && npm start`, check `GET /api/health` → 200 and one authenticated read (e.g. `GET /api/goals/active` with a valid session).

### Point-in-time recovery (provider)

Follow provider docs; after PITR, run step 3–4 above.

## Migration Recovery

- Migrations are additive, idempotent (`applied` set in `_prisma_migrations`), and never destructive.
- If `npx prisma migrate deploy` fails mid-migration, the transaction rolls back (each migration folder is one `BEGIN/COMMIT` in `apply-migrations.mjs`). Re-run `migrate deploy`.
- Hand-authored SQL migrations are proven by clean-DB apply in CI (when DB is available) — add `DATABASE_URL_TEST` connectivity check to CI.

## Incident Process

1. **Detect:** `logError` with `category: db_unavailable` + health check failing.
2. **Decide:** Is it app or DB? `GET /api/health` ok but `GET /api/goals/active` 503 → DB.
3. **Mitigate:** Flip read-only banner (deferred feature) if partial; else failover to standby.
4. **Restore:** Pick newest backup ≤ RPO, restore to new DB, point `DATABASE_URL` there, deploy.
5. **Verify:** Run `npx prisma migrate deploy` (should be “already up to date”), then a synthetic login → goal → roadmap → evidence flow.
6. **Post-mortem:** Record RPO actual, data lost window, and fix.

## Drills

- Quarterly restore drill: restore to a disposable `mureeh_restore_test` DB and run `npm test` against it.
- Never claim “backups are verified” unless the drill has been run since the last provider change.

## What Is NOT Yet Verified Here

- Provider PITR enablement status — check and record.
- `pgbouncer` + `adapter-pg` Pool behavior under provider failover — test before declaring multi-AZ ready.
- `next/font/google` offline build — use `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` fixture in CI.

## Quick Commands

```bash
# Dump
pg_dump --format=custom --file=/tmp/mureeh_$(date +%Y%m%d_%H%M).dump $DATABASE_URL

# Restore to test DB
pg_restore --clean --if-exists --dbname=$DATABASE_URL_TEST /tmp/mureeh_*.dump

# Apply migrations to the restored DB
DATABASE_URL=$DATABASE_URL_TEST node scripts/apply-migrations.mjs

# Smoke test
curl -f http://localhost:3000/api/health
```
