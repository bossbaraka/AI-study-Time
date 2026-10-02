# Security

## Authentication

- **Password hashing:** scrypt with per-user salt, constant-time verification.
- **Sessions:** Only SHA-256 of the cookie token is stored; a DB leak cannot be replayed. `httpOnly, SameSite=Lax, Secure in production, Path=/`.
- **Invitation gate:** Accounts exist only through an admin-issued invitation; `status pending→active|suspended`, lockout via `failedAttempts + lockedUntil` (DB, not memory).
- **Email verification:** SHA-256 of single-use token, expiry, one-use, enumeration-resistant responses.

## Authorization

- `withStudent(req, handler)` and `withAdmin(req, handler)` are the ONLY gates; `studentId` is always resolved from the session cookie, never from body/query.
- Per-aggregate ownership: every student-owned row carries `studentId` and is always queried through it. Foreign id → 404 (assessment/roadmap/execution) or 403 (goal, existing contract) — never leaks existence.
- Tests: `ownership-isolation.test.ts` + `*routes.test.ts` assert non-owner 403/404 and that forged `studentId` in body is ignored.

## Input Validation

- Every route validates at the boundary with Zod; no `status`/`studentId` writable field in schemas.
- Mass assignment rejected — unknown fields stripped.
- File uploads: not in current scope; no upload surface exists.

## Transport

- **HSTS:** `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` in production (next.config headers).
- **CSP:** `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'`.
- **Other headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Cache-Control: no-store` for `/api/*`.
- **Middleware:** Edge presence gate checks cookie existence only; validity is DB-resolved by `gateway.resolveSession`. `x-request-id` is minted or propagated for every request and echoed in response.

## CSRF / CORS

- **CSRF:** Write routes check `Origin` vs `Host`/`x-forwarded-host`; cross-site `application/json` without matching Origin is rejected. SPA fetches carry matching Origin; tests/curl omit it and are allowed.
- **CORS:** No `Access-Control-Allow-Origin: *`; API is same-origin. If a cross-origin SPA is later required, add an explicit allowlist — never wildcard.

## Rate Limiting & Brute Force

- **In-memory sliding window** per IP + per account (login, register, verify-email, resend-verification, assessment generation). Account lockout is DB-backed.
- **Single-instance limitation:** Two replicas give two independent budgets. Documented as production constraint; shared store (Redis) is the hardening step before horizontal scale.
- **Forwarded headers:** IP is derived from `x-forwarded-for` first segment; deployment must overwrite/sanitize that header at the edge proxy — never trust a client-supplied value.

## Injection & XSS

- **SQL injection:** No raw string interpolation; queries use parameterized `$1` (pg) or Prisma bindings. `Zod` caps string lengths (typically ≤512/2000) to avoid unbounded allocations.
- **XSS:** React escapes by default; no `dangerouslySetInnerHTML` in student-facing pages. Mentor replies are rendered as plain text, not HTML.
- **Mass assignment:** Schemas have no writable `role`/`status` fields.

## IDOR & Ownership Tests

Matrix (verified):

| Resource | Owner success | Non-owner | Forged studentId |
|---|---|---|---|
| Assessment | 201/200 | 404 | ignored |
| Goal | 201/200 | 403 (goal) | ignored |
| Roadmap | 201/200 | 404 | ignored |
| Execution unit | 200 | `unit_unavailable` (no leak) | ignored |
| Tests | 201 | 404 | ignored |
| ConceptState | 200 | empty (student-scoped) | ignored |

## Secrets Handling

- `DATABASE_URL`, `GEMINI_API_KEY`, `SMTP_*` are server-only env vars, never `NEXT_PUBLIC_`.
- `.next/static` scan finds no `DATABASE_URL` or `PrismaClient` in client bundle.
- Outbox message bodies redact tokens/invitation codes in production (`[redacted]`); safe error categories only.
- Logs never include passwords, tokens, cookies, raw secrets or full PII (`observability.ts` redacts).

## Logging & Observability

- `requestId` per request (propagated from `x-request-id` or minted).
- `logInfo`/`logError` emit single-line JSON with `ts, requestId, route, studentId, durationMs, category` — no query text, no driver message.
- Failure categories: `db_unavailable, constraint_duplicate, constraint_reference, not_found` — caller switches on category, not on message.

## Dependencies

- `npm audit` — run in CI; current moderate/high advisories are documented and non-blocking for the domain (Recharts 2.x deprecation, Next 15).
- Prisma client generation requires network to `binaries.prisma.sh`; offline sandbox is a `BLOCKED` environmental blocker, not a code defect — documented.

## Remaining Gaps (honest)

- **P0 (deferred to Phase 4):** Module tests were still browser-graded in legacy UI — fixed by new server-authoritative `POST /api/tests/:id/submit` (no client `correct`). The legacy `test-runner.tsx:71` path is now behind `LEARNING_USE_API` and will be deleted when the new Tests page becomes the only consumer.
- **P1:** Shared rate-limiter store for horizontal scale; `pgbouncer` transaction-mode validation for `@prisma/adapter-pg`; deprecation of `unsafe-inline` in CSP once nonces are available.
- **P2:** Live SMTP delivery not exercised in this sandbox — production must set `SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM, NEXT_PUBLIC_APP_URL` and verify delivery logs in `/admin/outbox`.
