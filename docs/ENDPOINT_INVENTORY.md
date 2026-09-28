# Endpoint Inventory — Phase 3 (filesystem-verified)

Inventory rebuilt from **every `route.ts` currently on disk** and every exported HTTP method, then cross-checked against service imports and route-handler bodies. This replaces the Phase 1 snapshot below; its missing counts are historical, not current.

- **43 route files, 45 HTTP handlers** (one `/api/goals/:goalId` file exports both GET and PATCH).
- **45 REAL, 0 PARTIAL, 0 mock-backed route handlers, 0 duplicate handlers.**
- **17 handlers added in Phase 3:** 7 goal, 5 roadmap, 5 execution.
- **One removed route remains DEAD:** `POST /api/assessment/generate`; it was removed because it exposed answer keys. No consumer calls it.
- The filesystem contains no goal/roadmap/execution route duplicated at another path.

`REAL` means the route reaches a real application/domain operation and PostgreSQL (or, for liveness, reports only process health). `PARTIAL` means a route exists but its current behavior is a stub, not a completed durable operation. `MOCK` would mean a route still uses mock persistence; none do. A UI service with no route is marked `DEFERRED`, not quietly counted as an API.

## 1. Assessment — 9 handlers, REAL

Route path params and bodies are validated with `assessment-api.ts`; every handler requires a student session. The Prisma-backed assessment engine owns the session, answer key, grading and result. Session question keys are stored in a separate database column and never serialized before submission.

| Endpoint | Auth / owner | Validation | Application → domain → persistence | Contract / side effects | Tests | Status |
|---|---|---|---|---|---:|---|
| `POST /api/assessment/sessions` | student; creates for caller | `createSessionSchema` | `assessmentApplication.createSession` → assessment engine → `AssessmentSessionStore` → Prisma/PostgreSQL | `{profile?}` → `201 AssessmentSession`; rate limit before optional question generation; answer key server-only | 18 HTTP integration | REAL |
| `GET /api/assessment/sessions/active` | student; caller | none | assessmentApplication.getActiveSession → assessment engine → session store → PostgreSQL | `AssessmentSession \| null` | 18 shared HTTP tests | REAL |
| `GET /api/assessment/sessions/:sessionId` | student; session owner | bounded `sessionId` | assessmentApplication.getSession → assessment engine → PostgreSQL | session; foreign/missing `404` | 18 shared HTTP tests | REAL |
| `POST /api/assessment/sessions/:sessionId/answers` | student; session owner | bounded path + `submitAnswerSchema`; body/path ids must agree | assessmentApplication.submitAnswer → assessment engine → PostgreSQL | response only; server scores; submission idempotency | 18 shared HTTP tests | REAL |
| `POST /api/assessment/sessions/:sessionId/pause` | student; session owner | bounded `sessionId` | assessmentApplication.pauseSession → assessment engine → PostgreSQL | named lifecycle transition | 18 shared HTTP tests | REAL |
| `POST /api/assessment/sessions/:sessionId/resume` | student; session owner | bounded `sessionId` | assessmentApplication.resumeSession → assessment engine → PostgreSQL | named lifecycle transition | 18 shared HTTP tests | REAL |
| `POST /api/assessment/sessions/:sessionId/complete` | student; session owner | bounded `sessionId` | assessmentApplication.completeSession → assessment engine → PostgreSQL | complete transition; diagnosis becomes readable | 18 shared HTTP tests | REAL |
| `GET /api/assessment/sessions/:sessionId/results` | student; session owner | bounded `sessionId` | assessmentApplication.getResults → assessment engine → PostgreSQL | derived assessment result; incomplete-session domain error preserved | 18 shared HTTP tests | REAL |
| `GET /api/assessment/results/latest` | student; caller | none | assessmentApplication.getLatestCompletedResult → assessment engine → PostgreSQL | latest result or `null` | 18 shared HTTP tests | REAL |

`POST /api/assessment/generate` is **DEAD/removed**, intentionally: it returned the private scoring bank. The replacement creates the session and returns only its public question projection.

## 2. Goals — 7 handlers, REAL

Every input is validated at the HTTP boundary with `goal-api.ts`. The schema contains **no `status` field**. `studentId` is always derived from the authenticated cookie. `GoalApplication` resolves diagnosis context server-side; the client cannot attach a fabricated assessment result.

| Endpoint | Auth / owner | Validation | Application → domain → persistence | Contract / side effects | Tests | Status |
|---|---|---|---|---|---:|---|
| `POST /api/goals` | student; creates for caller | `createGoalSchema` | `goalApplication.createGoal` → goal engine → `GoalStore` → Prisma/PostgreSQL; assessment result source | `{input,idempotencyKey}` → `201 GoalWithValidation`; server attaches diagnosis; same key replays | 19 HTTP integration | REAL |
| `GET /api/goals/active` | student; caller | none | application → goal engine → PostgreSQL | current live goal or `null` | 19 shared HTTP tests | REAL |
| `GET /api/goals/:goalId` | student; goal owner | bounded path id | application → `ownGoal` → PostgreSQL | goal; missing `404 goal_not_found`, foreign `403 forbidden` (existing contract) | 19 shared HTTP tests | REAL |
| `PATCH /api/goals/:goalId` | student; goal owner | bounded path + non-empty `goalRefinePatchSchema` | application → goal state machine/validation → PostgreSQL | refinement only; locked goal refuses `409 invalid_transition`; `status` cannot be written | 19 shared HTTP tests | REAL |
| `GET /api/goals/:goalId/validation` | student; goal owner | bounded path id | application → goal validation → PostgreSQL read | `GoalValidationResult`; no write/version bump | 19 shared HTTP tests | REAL |
| `POST /api/goals/:goalId/lock` | student; goal owner | bounded path + idempotency key | application → goal state machine → PostgreSQL | named lock transition; unique key makes concurrent replay safe | 19 shared HTTP tests | REAL |
| `POST /api/goals/:goalId/revise` | student; goal owner | bounded path id; no body | application → transactional revision of old + new goal → PostgreSQL | `201 GoalWithValidation`; original remains as history | 19 shared HTTP tests | REAL |

Ownership is intentionally 403 for a foreign goal: it is the existing engine/service contract and changing to 404 would be a public behavior change. The route tests pin it.

## 3. Roadmaps — 5 handlers, REAL

`roadmap-api.ts` accepts only a goal id for generation; no client-supplied plan, milestones, duration override, ownership or status. The existing deterministic planner and its structure gate remain the sole plan authority.

| Endpoint | Auth / owner | Validation | Application → domain → persistence | Contract / side effects | Tests | Status |
|---|---|---|---|---|---:|---|
| `GET /api/roadmaps/active` | student; caller | none | application → roadmap engine → `RoadmapStore` → Prisma/PostgreSQL | live roadmap or `null` | 12 HTTP integration | REAL |
| `POST /api/roadmaps/generate` | student; locked goal owner | `generateRoadmapSchema` | application → goal ownership/lock check → planner + structure validation → PostgreSQL transaction | `{goalId}` → `201` created / `200` idempotent replay; unique generation key | 12 HTTP integration | REAL |
| `GET /api/roadmaps/:roadmapId` | student; roadmap owner | bounded path id | application → roadmap engine → PostgreSQL | full bounded generated tree; foreign/missing `404 roadmap_not_found` | 12 shared HTTP tests | REAL |
| `POST /api/roadmaps/:roadmapId/pause` | student; roadmap owner | bounded path id; no body | application → roadmap state machine → PostgreSQL | named pause transition | 12 shared HTTP tests | REAL |
| `POST /api/roadmaps/:roadmapId/resume` | student; roadmap owner | bounded path id; no body | application → roadmap state machine → PostgreSQL | named resume transition | 12 shared HTTP tests | REAL |

No milestone or unit tree is built in a route. The engine planner and persisted tree are exercised end-to-end by route tests.

## 4. Execution — 5 handlers, REAL

Each unit id is resolved inside the caller's active roadmap. No request accepts a verdict, `status`, student id or dependency override. Progress and unlock states are derived from persisted execution rows and the roadmap graph.

| Endpoint | Auth / owner | Validation | Application → domain → persistence | Contract / side effects | Tests | Status |
|---|---|---|---|---|---:|---|
| `GET /api/executions/view` | student; caller's active roadmap | none | application → execution projection + execution/roadmap ports → PostgreSQL | derived view or `null` | 10 HTTP integration | REAL |
| `GET /api/executions/units/:learningUnitId/context` | student; unit in caller's active roadmap | bounded path id | application → execution engine/roadmap lookup → PostgreSQL | unit, milestone, execution, derived status, next unit; no active plan is an explicit domain error | 10 HTTP integration | REAL |
| `POST /api/executions/units/:learningUnitId/start` | student; unit in caller's active roadmap | bounded path id; no body | application → dependency gate + execution state machine → PostgreSQL | idempotently starts/resumes; blocked prerequisites cannot be bypassed | 10 HTTP integration | REAL |
| `POST /api/executions/units/:learningUnitId/evidence` | student; unit in caller's active roadmap | bounded path + evidence length schema | application → evidence/state rules → PostgreSQL | solution/reasoning only; blank evidence preserves `422 evidence_invalid`; client verdict ignored | 10 HTTP integration | REAL |
| `POST /api/executions/units/:learningUnitId/evaluate` | student; unit in caller's active roadmap | bounded path id; no body | application → deterministic evidence policy → PostgreSQL | verdict derived server-side; no client grading or LLM mutation | 10 HTTP integration | REAL |

A non-owner with no active roadmap receives the existing non-leaking `unit_unavailable` response and cannot read or mutate the owner's execution row.

## 5. Auth — 8 handlers: 8 REAL

| Endpoint | Auth / owner | Validation | Service / domain / persistence | Contract / tests | Status |
|---|---|---|---|---|---|
| `POST /api/auth/login` | public | login schema | auth gateway → Prisma/PostgreSQL; session cookie | session creation + account lock/rate rules; gateway tests and HTTP flow after verification | REAL |
| `POST /api/auth/register` | public | register schema | auth gateway → invitation + user(emailVerification=pending) + hashed token + SMTP/outbox + audit | invitation-only, no auto-login; registration→verification→login HTTP test | REAL |
| `POST /api/auth/logout` | cookie optional | no body contract | auth gateway → Prisma/PostgreSQL | revokes session and clears cookie; gateway tests | REAL |
| `GET /api/auth/session` | cookie optional | none | auth gateway → Prisma/PostgreSQL | current session state or unauthenticated; gateway tests | REAL |
| `POST /api/auth/forgot-password` | public | forgot schema | auth gateway → reset token + SMTP/outbox + audit in PostgreSQL | enumeration-resistant response; safe SMTP state recorded in outbox; gateway tests | REAL |
| `POST /api/auth/reset-password` | public | reset schema | auth gateway → transaction: user update, token used, sessions revoked | token error codes preserved; gateway tests | REAL |
| `POST /api/auth/verify-email` | public | `{token}` required, trimmed, 1–512 chars (`verifyEmailSchema`) | hash lookup → expiry/one-use check → transactional user verification in PostgreSQL | returns `verified`, `already-verified`, `expired`, or `invalid`; gateway + HTTP flow tests | REAL |
| `POST /api/auth/resend-verification` | public | email validated with `resendVerificationSchema`; per-email and per-IP rate limit | enumeration-resistant lookup → old-token invalidation → new hashed token + SMTP/outbox | identical acknowledgement for unknown/verified/pending accounts; gateway tests | REAL |

Invitation registration now leaves `emailVerification=pending`; login and session resolution reject unverified users. Only SHA-256 token hashes are stored in the verification table. Production outbox bodies redact verification/reset tokens and invitation codes; SMTP delivery state records `pending`, `sent`, or `failed` with a safe error category. Configure `SMTP_*` and `NEXT_PUBLIC_APP_URL` in the deployment environment; local tests use the inspectable outbox and never contact SMTP.

## 6. Admin — 10 handlers, REAL

All admin routes use `withAdmin` (cookie → session → role) and the PostgreSQL-backed auth gateway. Collection queries are bounded: users/invitations 200, audit 100, outbox 30, with deterministic descending-created ordering. Admin mutations validate body schemas and record audit effects.

| Endpoint | Auth / owner | Validation | Service / domain / persistence | Tests | Status |
|---|---|---|---|---|---|
| `GET /api/admin/audit` | admin | fixed limit 100 | gateway → PostgreSQL | gateway tests; no route HTTP suite | REAL |
| `GET /api/admin/invitations` | admin | fixed limit 200 | gateway → PostgreSQL | gateway tests; no route HTTP suite | REAL |
| `POST /api/admin/invitations` | admin | invitation schema | gateway → PostgreSQL + outbox/audit | gateway tests; no route HTTP suite | REAL |
| `POST /api/admin/invitations-revoke` | admin | id schema | gateway → PostgreSQL + audit | gateway tests; no route HTTP suite | REAL |
| `GET /api/admin/outbox` | admin | fixed limit 30 | gateway → PostgreSQL | gateway tests; no route HTTP suite | REAL |
| `POST /api/admin/sessions-revoke` | admin | target id schema | gateway → PostgreSQL + audit | gateway tests; no route HTTP suite | REAL |
| `GET /api/admin/summary` | admin | none | gateway → bounded PostgreSQL aggregates | gateway tests; no route HTTP suite | REAL |
| `GET /api/admin/users` | admin | fixed limit 200 | gateway → PostgreSQL | gateway tests; no route HTTP suite | REAL |
| `POST /api/admin/users-status` | admin | status schema | gateway → PostgreSQL + audit | gateway tests; no route HTTP suite | REAL |
| `POST /api/admin/users-unlock` | admin | target id schema | gateway → PostgreSQL + audit | gateway tests; no route HTTP suite | REAL |

No normal student path supports cross-student access; admin cross-student actions require the separate admin role gate. No new role or permission was introduced.

## 7. Health — 1 handler, REAL liveness

| Endpoint | Auth | Validation | Behavior | Status |
|---|---|---|---|---|
| `GET /api/health` | public | none | Liveness only: returns process status, service name and time; deliberately does not query PostgreSQL. Database-dependent operations surface their own 503. | REAL |

## 8. HTTP contracts and error behavior

- Validation: **400** `{code:"unknown"}`; schemas never echo user input or schema internals.
- Authentication: **401** existing `AuthGatewayError` code.
- Role: **403** `forbidden`.
- Ownership/not-found: domain contract preserved (goal foreign 403; roadmap/assessment foreign 404; execution resolves within the owner's active plan).
- Domain state errors: stable codes preserved; transitions generally **409**, invalid evidence **422**.
- DB constraint conflict: **409** `conflict`.
- Database unavailable: **503** `service_unavailable`; never a mock fallback.
- Unexpected errors: **500** `unknown`; SQL, Prisma error objects, stack traces and driver messages are not serialized.

All new goal/roadmap/execution handlers use a shared application error funnel. No route imports Prisma or calls a Prisma delegate directly.

## 9. Deferred service contracts — no route, no fake production data

These service families still describe mock/demo behavior and have no settled Phase 3 domain API. They are **not** counted as missing endpoints to implement with fake CRUD; they are explicitly deferred. `mockRequest` now refuses outside Vitest unless `NEXT_PUBLIC_DEMO_DATA=true` in a non-production runtime, returning `501 feature_deferred` without invoking its resolver. Production ignores the demo flag. This prevents seeded student data from being shown as persisted data.

| Service family | Still mock-only operations | Classification / phase |
|---|---|---|
| `journey`: student profile, legacy roadmap, daily plan, mission, request-change | no corresponding engine/API for these legacy shapes | DEFERRED; current dashboard goal is projected only from authenticated real goal data; other demo calls fail explicitly |
| `learning`: resources, recall schedule, tests/results, mastery | no Phase 3 persistence/domain endpoints; client-side test grading remains | DEFERRED_TO_PHASE_4; do not promote test grading until server-authoritative |
| `intelligence`: behavior, recovery, mentor | no stable engine ports/API | DEFERRED_TO_PHASE_4/5 |
| `engagement`: achievements, certificates, notifications, plans, guardian | no stable persisted entities/contracts | DEFERRED_TO_PHASE_4/6 |

## 10. Production data-flow audit

Verified after implementation:

- New routes → application services → domain engines → repository ports → Prisma/PostgreSQL; static search finds **zero Prisma imports/delegate calls in `src/app/api/**/route.ts`**.
- The three new client service groups use HTTP outside Vitest (`GOALS_USE_API`, `ROADMAPS_USE_API`, `EXECUTIONS_USE_API`); assessment and auth retain their existing HTTP-in-application switches.
- Database-unavailable behavior comes from the single server client and common error mapper; there is no production composition root with a memory/localStorage fallback.
- `new PrismaClient()` has exactly one production source site: `src/lib/server/db.ts`. Module caching reuses it per server process; development hot reload reuses the `globalThis` slot. `PrismaPg` receives `DATABASE_URL` there, not per request.
- `.next/static` scan finds no `DATABASE_URL`, `PrismaClient`, or local test credentials.
- Remaining `mockRequest`/`mock-db`/localStorage service paths are Vitest-only or explicit non-production demo; production mock calls fail before the resolver runs. `localStorage` in the locale provider and auth mock remains browser/dev/test infrastructure, not a learning persistence source.
- Query bounds: admin collections have explicit `take` limits (200/200/100/30); assessment history returns only latest/active or one bounded session; roadmap/execution results are the student's generated bounded plan, not an unbounded history listing. No cursor API was added without an existing consumer contract.
- Rate limit: in-memory sliding window, protecting login, registration, email verification/resend, and assessment generation. Account lockout is DB-backed. Limiter is single-process only; multi-instance shared limiting is **PRODUCTION HARDENING**, not a reason to add Redis in this phase. IP buckets consume `x-forwarded-for`, so the deployment proxy must overwrite/sanitize it; do not trust a client-supplied forwarded header at the public edge.

## 11. Current status snapshot

Phase 3 added all 17 Goal/Roadmap/Execution handlers and replaced the auth email acknowledgements with persisted one-use verification and SMTP/outbox operations. PostgreSQL-backed HTTP tests cover invitation registration → token verification → login. The remaining mock-only service families are explicitly deferred, not presented as production data.
