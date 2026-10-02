# Operations

## Observability

- **Request ID:** `x-request-id` (propagated from client or minted in middleware). Echoed on every response, including redirects. Used as `correlationId` for `LearningEvent` chains and as `requestId` in logs.
- **Structured logs:** One JSON line per failure with `ts, requestId, operation (scope + pathname), userId, durationMs, category, status`. Categories: `db_unavailable, constraint_duplicate, constraint_reference, not_found, internal`. No query text, no secrets.
- **Success metrics:** Not yet centralized — Phase 8. Add `logInfo({ operation, requestId, durationMs, status })` on the happy path when a metrics pipeline exists; don’t log per-request bodies.
- **Health:** `GET /api/health` (liveness only). DB failures are 503 on the data route, not on health.

## Alerts (recommended)

| Signal | Threshold | Action |
|---|---|---|
| `rate(db_unavailable) > 0` for 2 min | P1 | Page on-call, check `DATABASE_URL` / provider status |
| `increase(constraint_duplicate)` spike | P2 | Investigate client retry storm; idempotency keys should make this benign |
| `p50 latency > 800ms` for 5 min | P2 | Check PG slow queries (`pg_stat_statements`), AI latency |
| `SMTP failed > 5` in 10 min | P2 | Check `SMTP_*` env, provider, and `/admin/outbox` lastDeliveryError |

## Runbooks

### Database unavailable (503)

1. Check provider dashboard (Postgres status, connection count, CPU).
2. Try `psql $DATABASE_URL -c "select 1"` from the app host.
3. If `pgbouncer` in pool, check `prepared statements` errors → disable `prepare` in adapter.
4. Rotate `DATABASE_URL` if leaked; restart app.

### Email not delivering

1. Check `/admin/outbox` `deliveryStatus` and `lastDeliveryError` (safe category only).
2. Verify `SMTP_*` and `NEXT_PUBLIC_APP_URL` env.
3. Trigger resend via `POST /api/auth/resend-verification` and watch logs.

### AI generation failing

1. Check `GEMINI_API_KEY` set and not expired.
2. Watch `logError` with `category: ai_error`; fallback `MockAIProvider` should keep product functional — no user-visible outage, but quality degrades.
3. If fallback also fails, check `question-generator.ts` timeout (8s) and retry (once).

## On-Call

- Primary: app logs + health + outbox.
- Secondary: DB provider status page.
- No PII in pages; use `userId` short prefix only.

## Deployment Verification (smoke)

```bash
curl -fs http://localhost:3000/api/health | grep '"status":"ok"'
# Auth smoke (requires an invitation code)
curl -fs http://localhost:3000/api/auth/session | grep '"status"'
```

Full E2E smoke (the critical path):

```
Register (with invitation)
→ Verify (token)
→ Login
→ Create Assessment Session → Answer → Complete → Results
→ Create Goal → Lock
→ Generate Roadmap
→ Start Unit → Submit Evidence → Evaluate
→ Check ConceptState (knowledge increased)
→ Check Diagnosis (no misconception)
→ Get Adaptive Next (has reason)
→ Schedule Recall (due tomorrow)
→ Submit Test (server-graded)
→ Mentor Chat (context-aware)
```

This is the “happy path” that must be run after every deployment, not just `npm run build`.
