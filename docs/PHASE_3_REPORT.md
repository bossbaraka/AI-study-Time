# Phase 3 Report — Real APIs, Authorization, Production Data Flow

Branch: `arena/01a0e78e-ai-study-time` · Phase 2 baseline: `ae93ea3` · Endpoint detail: [`ENDPOINT_INVENTORY.md`](./ENDPOINT_INVENTORY.md)

## 1. Executive Summary

Phase 3 connected the existing Goal, Roadmap and Execution domain engines to authenticated HTTP routes and the browser's real HTTP transport. The work adds the missing **17 handlers** without replacing the engines or their rules. The production path is now:

```
Browser service → same-origin HTTP → route → cookie/session identity
  → role/ownership gate → Zod boundary → application service
  → domain engine → repository port → Prisma → PostgreSQL
```

The 17 new handlers are covered by route integration tests against PostgreSQL; an additional runtime-flow test begins at the production client service, dispatches `fetch` to the actual route handlers, and checks the rows in PostgreSQL. The browser-side transport branches are selected outside Vitest, not by a per-request fallback.

Phase 3 auth now has real invitation-bound email verification: accounts remain unverified until a hashed, expiring, single-use token is consumed; login and session resolution reject unverified accounts. SMTP delivery is attempted from the persisted outbox, delivery status is visible to admins, and production outbox bodies redact tokens and invitation codes. SMTP and the public app origin must be configured in the deployment environment.

Two findings prevent a PASS claim:

1. **The module-testing feature is still not server-authoritative.** The browser computes correctness and the feature has no persisted domain/API. This P0 remains deferred pending approved per-question rubrics for AI grading.
2. **Several Phase 4/5 product services have no domain API yet.** Their mock transport fails explicitly with `501 feature_deferred` outside Vitest unless `NEXT_PUBLIC_DEMO_DATA=true` in a non-production runtime. The production demo flag is ignored, so missing persistence cannot look like real student data. The latest Vercel preview is pending; the prior failed deployment's protected logs could not be inspected, and restored project access is not yet confirmed.

**Final status: `PHASE 3 — PARTIAL`.** Goal/Roadmap/Execution and auth token-verification paths are implemented and verified. Deferred learning features and the pending Vercel preview status are disclosed rather than hidden.

## 2. Endpoint Inventory

The inventory was regenerated from the filesystem and exported method declarations, not copied from the Phase 1 counts: **43 route files / 45 HTTP handlers**. There are **45 REAL, 0 PARTIAL, 0 mock-backed and 0 duplicate handlers**. Seventeen handlers were added for Goal (7), Roadmap (5) and Execution (5); the two existing auth email operations now reach persisted token state and SMTP/outbox delivery. See the full per-handler table—including auth, owner, validation, service/domain/repository, contract, and test coverage—in [`docs/ENDPOINT_INVENTORY.md`](./ENDPOINT_INVENTORY.md).

| Area | Handlers | REAL | PARTIAL | Missing current Phase 3 engine routes |
|---|---:|---:|---:|---:|
| Assessment | 9 | 9 | 0 | 0 |
| Goal | 7 | 7 | 0 | 0 |
| Roadmap | 5 | 5 | 0 | 0 |
| Execution | 5 | 5 | 0 | 0 |
| Auth | 8 | 8 | 0 | 0 |
| Admin | 10 | 10 | 0 | 0 |
| Health | 1 | 1 (liveness only) | 0 | 0 |
| **Total** | **45** | **45** | **0** | **0** |

`POST /api/assessment/generate` is still intentionally removed (DEAD): it disclosed answer keys. No duplicate route/method definitions were found. The new HTTP handlers contain no Prisma imports or Prisma delegate calls.

## 3. Production Data Flow

### Assessment

```
assessmentService (HTTP outside Vitest)
 → POST /api/assessment/sessions
 → withStudent: cookie → authenticated student
 → Zod profile validation → per-student rate limit
 → AssessmentApplication (question generation coordination)
 → assessment engine → AssessmentSessionStore
 → Prisma → PostgreSQL
```

Other assessment reads/transitions use the same route/auth/application/domain/repository layers. Dynamic session ids are bounded before repository access. Correctness and answer keys stay server-side; HTTP integration tests assert the public projection does not serialize answer-key fields.

### Goal

```
goalDiscoveryService / dashboard projection
 → /api/goals/*
 → withStudent → server-derived student id → goal-api Zod schemas
 → GoalApplication
 → goal engine (diagnosis resolved from the server assessment source)
 → GoalStore → Prisma → PostgreSQL
```

The body cannot select an owner or diagnosis. The dashboard no longer falls back to the seeded goal in application mode: no locked goal is a `goal_not_found` error, not fabricated progress.

### Roadmap

```
roadmapService
 → /api/roadmaps/*
 → withStudent → goalId/path validation
 → RoadmapApplication
 → locked-goal ownership/state check → existing planner + quality gate
 → RoadmapStore transaction → Prisma → PostgreSQL
```

The client sends only the goal id. Planner choices, dependencies, feasibility and plan structure are domain-owned. `generationKey` remains the database idempotency boundary.

### Execution

```
executionService
 → /api/executions/*
 → withStudent → unit-id/evidence validation
 → ExecutionApplication
 → active-roadmap resolution + dependency/state/evidence rules
 → ExecutionStore/RoadmapLookup → Prisma → PostgreSQL
```

The client cannot choose a verdict/status or bypass prerequisite gating. The HTTP tests prove that evidence is persisted before evaluation, that the server derives the result, and that a blocked unit cannot be started by posting forged state.

### Authentication and admin

Auth remains on its existing server gateway; it uses one shared Prisma client and PostgreSQL. Admin operations require `withAdmin`; protected-route tests exercise anonymous and student rejection across all ten admin handlers. Password recovery/reset are now rate-limited before token/database work. Admin collection queries remain bounded.

## 4. Authorization Matrix

| Resource/action | Student | Admin | Owner requirement / enforced result |
|---|---|---|---|
| Assessment read/answer/lifecycle/results | yes | no | Session owner; foreign/missing session is 404. Identity comes from cookie. |
| Goal read/refine/validate/lock/revise | yes | no cross-student override | Owner; foreign goal remains 403 per the existing public contract; missing is 404. |
| Roadmap read/pause/resume | yes | no cross-student override | Owner; foreign/missing roadmap is 404. |
| Roadmap generate | yes | no | Requested goal must be owned by caller and locked. |
| Execution context/start/evidence/evaluate | yes | no | Resolve unit inside caller's active roadmap; no active plan returns domain `unit_unavailable`; foreign unit data is not disclosed. |
| Admin users/invitations/sessions/audit/outbox | no | yes | Admin role required server-side; ordinary student receives 403. |
| Auth login/register/recovery | public | public | Own credential/token validated server-side; no client identity is trusted. |
| Auth session/logout | optional cookie | optional cookie | Session resolved/revoked server-side; no request-body identity. |

No new roles or cross-student privileges were invented. Goal's 403 and roadmap/assessment's 404 difference is preserved and documented rather than silently changing a public contract.

## 5. Ownership Test Matrix

| Resource | Owner success | Non-owner read | Non-owner mutation | Forged `studentId` | HTTP test coverage |
|---|---|---|---|---|---:|
| Assessment session | yes | 404 | answer/pause/resume/complete/results rejected | ignored | 18 |
| Goal | create/read/validate/lock/revise | 403 | PATCH/lock/revise rejected; stored row unchanged | ignored; forged diagnosis ignored | 19 |
| Roadmap | generate/read/pause/resume | 404 | pause/resume rejected; DB state unchanged | ignored; plan still belongs to session student | 12 |
| Execution | context/start/evidence/evaluate | no active owner plan → non-leaking domain response | start/evidence/evaluate rejected; owner's submitted evidence unchanged | ignored | 10 |
| Admin | authorized admin paths | student receives 403 | all ten handlers reject student/anonymous | role derives from session resolver | 23 |
| Auth | valid/invalid public contracts | not applicable | token/session operations use gateway | no body identity accepted | 7 |

The production-flow test adds one end-to-end service→`fetch`→route→PostgreSQL journey spanning goal creation/lock, roadmap generation, execution view/context and unit start. It also proves the dashboard gives no seeded mock goal when the authenticated student has no locked goal.

The only test double in route integration is **session resolution**. Learning repositories, domain engines and Prisma are real. Admin route tests preserve the actual gateway operations and replace only session resolution.

## 6. Mock Leakage Audit

### Verified production behavior

- `grep` over every `src/app/api/**/route.ts`: **0 Prisma imports/delegates**; **0 mock-engine imports**.
- Server application services import only the canonical Prisma-backed `assessmentEngine`, `goalEngine`, `roadmapEngine`, `executionEngine` from `engines.server.ts`. Production exports no longer carry misleading `mock*Engine` names.
- Client `GOALS_USE_API`, `ROADMAPS_USE_API`, `EXECUTIONS_USE_API` are true outside Vitest. Assessment/auth retain their existing HTTP switches. A production-flow integration test overrides Vitest mode and confirms real service calls cross `fetch` into actual route handlers.
- `mockRequest` rejects before calling its resolver with `501 feature_deferred` unless Vitest is active or the explicit non-production demo opt-in is enabled. In production, `NEXT_PUBLIC_DEMO_DATA=true` is ignored.
- The dashboard goal uses the real goal API in application mode and has no seeded-goal fallback.
- The server has exactly **one** `new PrismaClient()` construction site (`src/lib/server/db.ts`); module caching reuses it per server process, with `globalThis` reuse under development hot reload. No client is created per request.
- `.next/static` contains **zero** matches for `DATABASE_URL`, `PrismaClient`, or the local test credential. Prisma/database imports remain in server modules.
- Remaining `mock-db`, localStorage stores and mock engines are test/demo infrastructure. Locale storage is a UI preference, not learning persistence. Browser mocks are not a production fallback.

### Rate limiting and query bounds

In-memory sliding-window limiter currently covers login, registration, assessment generation, forgot-password per normalized-email hash and source IP, and reset-token attempts per source IP. Database account lockout remains authoritative for login. Limiter is **single-process only**; multi-instance shared limits are marked PRODUCTION HARDENING, not an excuse to add Redis in this phase.

Admin lists use bounded takes: users 200, invitations 200, audit 100, outbox 30, ordered newest-first. Assessment reads are active/latest/single-session. Roadmap/execution return the student's generated plan rather than unbounded history. No cursor contract was invented without an existing consumer.

## 7. Changed Files

| Files | Change | Reason |
|---|---|---|
| `src/app/api/goals/**/route.ts` (6 route files) | Added 7 authenticated HTTP handlers | Expose existing goal domain operations and state transitions. |
| `src/app/api/roadmaps/**/route.ts` (5 files) | Added 5 authenticated handlers | Expose the existing deterministic planner and roadmap transitions. |
| `src/app/api/executions/**/route.ts` (5 files) | Added 5 authenticated handlers | Expose execution projection, dependency-gated start, evidence and evaluation. |
| `src/services/application/{assessment,goal,roadmap,execution}-application.ts` | Added application coordination boundaries | Keep AI/diagnosis/planning/execution coordination out of route handlers. |
| `src/schemas/{goal,roadmap,execution}-api.ts` | Added bounded request schemas | Validate HTTP DTOs without putting business rules in Zod. No state field accepted. |
| `src/app/api/assessment/**` | Route through assessment application; validate all session path ids | Preserve existing APIs while ensuring every external path id is bounded. |
| `src/lib/server/domain-errors.ts`, `src/lib/server/auth/request.ts` | Shared domain-to-HTTP mapping and request-correlated error funnel | Preserve stable domain codes; prevent SQL/Prisma messages from reaching callers/logs. |
| `src/services/engines.server.ts` | Canonical names for Prisma-backed production engines | Make a mock-to-production wiring mistake visible in review/static scans. |
| `src/lib/api/client.ts`, `src/services/{goal-discovery,roadmap,execution,journey}.service.ts` | Real HTTP transport outside Vitest; mock transport now explicit demo/test only | No production fallback to demo rows. |
| `src/services/auth.service.ts`, `src/lib/server/auth/gateway.ts`, auth routes, `src/lib/server/auth/mailer.ts` | Invitation registration now requires email verification; hashed, expiring one-use tokens; SMTP/outbox delivery state and safe token redaction | Keep auth identity server-authoritative, resend enumeration-resistant, and SMTP failures observable without leaking provider details. |
| `src/app/api/{admin,auth,assessment,goals,roadmaps,executions}/**/*routes.test.ts`, `src/app/api/production-flow.test.ts`, `src/lib/api/client.test.ts`, `src/test/route-harness.ts` | Real-handler security and persistence tests | Prove auth, ownership, validation, domain errors, PostgreSQL and runtime transport. |
| `src/schemas/auth.ts`, `src/app/api/admin/invitations/route.ts`, admin mutation handlers | Bound password/id inputs and accept the existing empty-optional national-id form; let `withAdmin` own the single correlated error funnel | Fix verified form/API mismatch; avoid unbounded external inputs and preserve requestId context. |
| `.env.example` | Document explicit demo opt-in plus `SMTP_*` transport and public app-origin settings | Keep demo data disabled in production and SMTP credentials server-only. |
| `docs/ENDPOINT_INVENTORY.md`, `docs/PHASE_3_REPORT.md` | Filesystem-verified endpoint inventory and this report | Record actual contracts, status, risks and deferred work. |

Phase 3 adds one additive PostgreSQL migration for one-use email verification tokens and SMTP delivery state. No destructive migration, framework change, database replacement or history rewrite occurred.

## 8. Tests and Build

| Check | Exact result | Status |
|---|---:|---|
| `npx eslint src` | 0 errors, 0 warnings | VERIFIED |
| `npx tsc --noEmit` | 0 errors | VERIFIED |
| `npm test` | **570 passed / 0 failed, 43 files** | VERIFIED |
| Repository integration | **31** = 20 shared adapter-contract + 11 PostgreSQL reality | VERIFIED |
| HTTP integration | **91** across assessment 18, admin 23, auth 7, goals 19, roadmaps 12, executions 10, full production-flow 1, auth registration→verification→login 1 | VERIFIED |
| Auth gateway tests | **21** domain tests (real PostgreSQL; the HTTP registration flow is counted above) | VERIFIED |
| Other unit/component tests | **427** | VERIFIED |
| Prisma schema validation using Prisma's JS schema engine (temporary local config) | valid schema | VERIFIED |
| PostgreSQL migrations | Three additive migrations / 16 tables; Phase 3 adds hashed email-verification tokens and SMTP delivery state, with no destructive changes | VERIFIED against local PostgreSQL |
| `npx next build` with local PostgreSQL and `NEXT_FONT_GOOGLE_MOCKED_RESPONSES` fixture | succeeds; 43 API paths emitted | VERIFIED via Next's official font-mock hook; live Google Fonts remains blocked |
| Build against live `fonts.googleapis.com` from this sandbox | network egress unavailable | BLOCKED |
| Vercel preview for commit `9a691ef` | status `pending`; previous failed deployment's protected logs were inaccessible | BLOCKED pending deployment result and confirmation of project access |

The test groups sum exactly: `91 HTTP + 31 repository contract/reality + 21 auth gateway-domain + 427 other unit/component = 570`. The route suites use real PostgreSQL; only session resolution is faked in protected-route suites. Auth routes and the gateway suite exercise registration → verification → login over actual HTTP handlers. SMTP transport tests stub only the external mail transport; token storage, rate limits, and auth persistence remain real. No `.skip()`, `.only()`, expected failure, or disabled assertion was introduced.

## 9. Security Findings

### P0 — open, deferred to Phase 4

The module-testing UI still computes correctness in the browser (`src/features/quizzes/components/test-runner.tsx`, `src/types/domain.ts` `TestResultAnswer.correct`). There is no settled server-side test domain, port, persisted question bank, or endpoint. The user approved AI-assisted grading but selected a rubric per question; those rubrics are not yet supplied. This P0 remains open until the rubric is defined and grading is moved server-side. No placeholder route or client-derived score was promoted as authoritative.

### P1 — production hardening

- Rate limiter is process-local. Multi-instance deployment can multiply its effective allowance; shared storage is required before horizontal production scaling. IP-based buckets use `x-forwarded-for` via `requestMeta`, so deployment must ensure its trusted proxy overwrites/sanitizes that header rather than forwarding a client-supplied value.
- Connection-pooler behavior for `engineType="client"` + `@prisma/adapter-pg` + `pg` still needs validation against the actual deployment target (carried from Phase 2; architecture not replaced).

### P2 — partial/deferred behavior

- Live SMTP delivery has not been exercised in this environment. Production must set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, and `NEXT_PUBLIC_APP_URL`; the admin outbox records safe delivery state and production-retained message bodies redact one-time credentials.
- Legacy learning, mastery, tests, recall, recovery, behavior, mentor and engagement contracts have no real domain API and now fail explicitly instead of displaying mock data as persisted data.
- Unmocked Next Google Fonts build remains blocked by this environment's network; `layout.tsx` was not modified to hide it.
- Fixed-size admin reads are bounded but do not expose cursors; no current consumer asks for cursor pagination.

### P3 — observability / operations

- Error logs include requestId, operation/route, safe userId where available, duration and category; successful-request metrics/traces are not introduced.
- Prisma client generation still depends on the configured engine mirror in this environment.

## 10. Deferred Work

- **Phase 4:** server-authoritative test runner and grading; mastery derivation/evidence; recall scheduler; recovery state machine; behavior model; any new learning entities/endpoints. Preserve existing product semantics until the domain rules are reviewed.
- **Phase 5:** AI provider abstraction, prompt/input hardening, schema-validated generation, timeout/retry/token budgets. SMTP transport exists for auth mail; deployment delivery still requires valid configuration and a live send check.
- **Phase 6:** broader security review/hardening, deployment-specific cookie/CSRF/proxy assumptions, multi-instance rate-limiter deployment decision.
- **Phase 7:** browser E2E (the repository still has no Playwright/E2E suite). Route-handler integration is not a substitute for a browser run.
- **Phase 8:** CI and production observability pipeline; no CI workflow is added ahead of the fixed phase order.

## 11. Final Status

**PHASE 3 — PARTIAL**
