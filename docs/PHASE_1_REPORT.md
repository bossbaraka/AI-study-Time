# Phase 1 Report — Baseline, Ports, and Removing Browser/Domain Coupling

Branch: `arena/01a0e78e-ai-study-time` · Base: `d8f177d`
Scope: §43 items 1–10 plus the §5B configuration unification.

## Summary

The domain is now independent of the browser and of the framework. All four
learning engines (assessment, goal, roadmap, execution) were converted from
singleton modules that read and wrote `window.localStorage` directly into
**factories that receive their storage through injected ports**. A single
composition root (`src/services/engines.ts`) decides which adapter each engine
gets; no engine imports another engine any more, which cuts the
`execution → roadmap → goal → assessment` import chain that previously made the
execution engine transitively depend on assessment scoring data.

Three security defects were closed:

1. **The AI answer key reached the browser.** `POST /api/assessment/generate`
   returned the generated question bank including `scoring.correctOptionId`,
   keyword lists and match thresholds. That route is deleted. Question
   generation moved server-side inside `POST /api/assessment/sessions`; the
   bank is stored on the session and only the public question projection is
   ever serialized to a client.
2. **Assessment sessions had no owner.** All sessions lived under one shared
   storage key, so on a shared device student B resumed student A's session and
   inherited A's diagnosis. Every session is now bound to a `studentId`
   resolved from the session cookie, and a foreign session is answered with
   `404 session_not_found` — never 403, so existence does not leak.
3. **`/api/assessment/generate` was unauthenticated, unvalidated and
   unrate-limited**, with user text interpolated straight into the Gemini
   prompt. Its replacement requires a signed-in student, validates the profile
   with Zod (every string length-capped), and rate-limits per student.

Assessment evaluation is server-authoritative end to end: the client submits
its *response*; the engine holds the key and decides the score. A smuggled
`{"correct": true}` is not part of the schema and provably changes nothing —
pinned by a differential test.

The nine assessment endpoints the client already called now exist, taking
assessment from 0/9 to 9/9 real routes. Goals (7), roadmaps (5) and executions
(5) remain missing and are inventoried in `docs/ENDPOINT_INVENTORY.md` in
dependency order.

**Status: PARTIAL** — everything in Phase 1 scope is implemented and verified
except the two items blocked by this sandbox (no `prisma generate`, no Google
Fonts egress), disclosed in full below.

## Files Changed

| File | Change | Reason |
|---|---|---|
| `docs/ARCHITECTURE_AUDIT.md` | added (Phase 0) | Audit deliverable |
| `docs/ENDPOINT_INVENTORY.md` | added | §43.8 — inventory before implementation |
| `docs/PHASE_1_REPORT.md` | added | This report |
| `src/services/ports/stores.ts` | added | `AssessmentSessionStore`, `GoalStore`, `RoadmapStore`, `ExecutionStore` — the minimal repository ports |
| `src/services/ports/lookups.ts` | added | `GoalLookup`, `RoadmapLookup`, `AssessmentResultSource` — read-only cross-aggregate seams |
| `src/services/infrastructure/collection-store.ts` | added | Memory + localStorage adapters behind the ports |
| `src/services/infrastructure/index.ts` | added | `createStores(backend)`, `resetAll()` |
| `src/services/engines.ts` | added | **Composition root** — the only module that wires engines to adapters |
| `src/services/assessment/mock-assessment-engine.ts` | rewritten as `createAssessmentEngine({sessions})` | Remove `localStorage`; add `studentId` ownership; keep scoring internal |
| `src/services/goals/mock-goal-engine.ts` | rewritten as `createGoalEngine({goals})` | Remove `localStorage`; take `diagnosisContext` as **input** instead of importing the assessment engine |
| `src/services/roadmap/mock-roadmap-engine.ts` | rewritten as `createRoadmapEngine({roadmaps, goals})` | Remove `localStorage`; depend on `GoalLookup` |
| `src/services/execution/mock-execution-engine.ts` | rewritten as `createExecutionEngine({executions, roadmaps})` | Remove `localStorage`; depend on `RoadmapLookup`; fix a latent wrong-variable write in the retry branch |
| `src/services/assessment.service.ts` | rewritten | Route every call through `httpRequest` (real) or the engine (test); delete the raw client-side `fetch("/api/assessment/generate")`; funnel all errors to `AssessmentApiError` |
| `src/services/goal-discovery.service.ts` | modified | `createGoal` resolves `diagnosisContext` via `assessmentResultSource` |
| `src/services/{roadmap,execution}.service.ts` | modified | Import engines from the composition root |
| `src/services/goals/active-goal-projection.ts` | modified | Import from the composition root |
| `src/app/api/assessment/sessions/route.ts` | added | `POST` — creates an owned session; generates questions server-side; rate-limited |
| `src/app/api/assessment/sessions/active/route.ts` | added | `GET` — caller's own unfinished session |
| `src/app/api/assessment/sessions/[sessionId]/route.ts` | added | `GET` — 404 for foreign sessions |
| `src/app/api/assessment/sessions/[sessionId]/answers/route.ts` | added | `POST` — server-authoritative grading |
| `src/app/api/assessment/sessions/[sessionId]/{pause,resume,complete}/route.ts` | added | `POST` — ownership-checked transitions |
| `src/app/api/assessment/sessions/[sessionId]/results/route.ts` | added | `GET` — diagnosis for one session |
| `src/app/api/assessment/results/latest/route.ts` | added | `GET` — caller's latest diagnosis |
| `src/app/api/assessment/generate/route.ts` | **deleted** | Leaked the answer key; unauthenticated; unvalidated |
| `src/schemas/assessment-api.ts` | added | Server-side Zod schemas; the client can never send a correctness verdict |
| `src/lib/server/auth/request.ts` | modified | `requireStudentApi()`, `withStudent()`, `errorResponse` now maps `ApiError` → `{code}` + its status |
| `src/types/assessment.ts` | modified | `unauthenticated`, `forbidden` error codes |
| `src/features/assessment/lib/errors.ts` | modified | Message keys for the two new codes |
| `src/lib/i18n/dictionaries/{en,ar}.ts` | modified | `assessment.errors.unauthenticated` / `.forbidden` |
| `src/lib/supabase/{client,server}.ts` | **deleted** | §5B — Prisma→PostgreSQL is the abstraction; no Supabase service is used |
| `prisma/schema.prisma`, `prisma/migrations/*`, `migration_lock.toml` | modified | §5B — unified on PostgreSQL; the SQLite DDL would have failed `migrate deploy` on 12 `DATETIME` columns |
| `.env.example` | modified | PostgreSQL-only; `DATABASE_URL_TEST`; `GEMINI_API_KEY`; Supabase keys removed |
| `src/test/setup.ts` | modified | Resets the auth backend and `resetAllEngines()` |
| `src/test/test-env.ts` | modified | PostgreSQL test DSN |
| `src/services/ownership-isolation.test.ts` | added | 14 cross-student isolation + answer-key regression tests |
| `src/app/api/assessment/assessment-routes.test.ts` | added | 12 HTTP-boundary integration tests |
| 12 existing test files | modified | Pass `studentId` / `diagnosisContext`; sign a student in; import engines from the composition root |

No unrelated file was touched; no project-wide reformatting was applied.

## Architecture Before

```
React component
   │
   ▼
service  ──USE_MOCK?──► engine (singleton)
   │                       │
   │                       ├─ window.localStorage      ← browser API in the domain
   │                       └─ import other engine      ← execution → roadmap → goal → assessment
   │
   └─(assessment only)──► raw fetch("/api/assessment/generate")
                             │
                             ▼
                          route returns { bank: [...scoring.correctOptionId...] }  → BROWSER
```

- Engines were module singletons: `export const mockGoalEngine = { ... }` with
  `loadGoals()`/`saveGoals()` touching `window.localStorage` inside domain
  methods.
- `mock-execution-engine` called `mock-roadmap-engine`'s `activeRoadmapFor()`,
  which called `mock-goal-engine`'s `loadLockedGoal()`, which called
  `mock-assessment-engine` for a diagnosis. Importing execution pulled in
  assessment scoring.
- Sessions were stored under one shared key `mureeh.mock.assessment.v1` with no
  `studentId` field.
- There was no `interface *Repository` anywhere in the codebase.
- `AssessmentService.createSession` bypassed its own transport seam with a raw
  `fetch`, so the mock/HTTP switch did not apply to it.

## Architecture After

```
React component
   │
   ▼
service ──ASSESSMENT_USE_API?──► httpRequest ──► route handler
   │                                               │  withStudent(req, …)
   │                                               │  ├─ cookie → student (never the body)
   │                                               │  ├─ Zod schema (bounded strings)
   │                                               │  └─ checkRate per student
   │                                               ▼
   └──(Vitest)──────────────────────────────► engine(deps)
                                                  │
              src/services/engines.ts ────────────┘   ← the ONLY wiring site
                 │
                 ├─ AssessmentSessionStore ─┐
                 ├─ GoalStore               ├─► memory | localStorage adapter
                 ├─ RoadmapStore            │
                 ├─ ExecutionStore         ─┘
                 ├─ GoalLookup        (roadmap ← goal)
                 ├─ RoadmapLookup     (execution ← roadmap)
                 └─ AssessmentResultSource (goal ← diagnosis, caller-resolved)
```

- Engines are factories: `createAssessmentEngine({ sessions })`,
  `createGoalEngine({ goals })`, `createRoadmapEngine({ roadmaps, goals })`,
  `createExecutionEngine({ executions, roadmaps })`. Every one takes `studentId`
  on every public method.
- `grep` confirms zero `window.*` / `localStorage` / `document.*` /
  `navigator.*` in any engine or in `src/services/{assessment,goals,roadmap,execution}/**`.
- `grep` confirms exactly one non-test file imports an engine module:
  `src/services/engines.ts`.
- `grep` confirms zero `@prisma`, `next`, `react` or `zod` imports inside the
  four engines.
- Domain rules were preserved, not rewritten: the roadmap 10-step pipeline,
  `ENGINE_VERSION`, `generationKey`, `validateRoadmapStructure()`, the Kahn
  topological sort, the goal heuristics (`HOURS_PER_LEVEL_STEP`, `BASE_HOURS`,
  `AGGRESSIVE_RATIO`, `UNREALISTIC_RATIO`), `EVIDENCE_POLICY` and all three
  pure state machines are untouched.

## Security Changes

| Change | Before | After |
|---|---|---|
| Answer key exposure | `/api/assessment/generate` returned `scoring.correctOptionId`, `keywords`, `minMatches` to the browser | Route deleted; bank stays on the stored session; `toClientSession` emits questions only |
| Generation endpoint auth | none | signed-in **student** required (`withStudent`) |
| Generation input validation | none — user text straight into the Gemini prompt | Zod `assessmentProfileSchema`; `targetSubject` trimmed and capped at 120 chars |
| Generation rate limit | none | `checkRate("assessment:create:<studentId>", 12)` |
| Session ownership | none — one shared storage key | `studentId` on every session, resolved from the cookie; `ownSession` 404s for a non-owner |
| Cross-student read | B could resume A's session and inherit A's diagnosis | 404 for `get`/`answer`/`pause`/`resume`/`complete`/`results`/`latest` |
| Grading authority | client could post a verdict | `SubmitAnswerPayload` carries only the response; the engine grades from its key |
| Body/URL disagreement | n/a | `sessionId` in the body must match the path, else 400 |
| Error leakage | n/a | `errorResponse` forwards only `{ code }` + status; messages never cross the boundary |

Authorization never reads a client-supplied `studentId`. The
`POST /api/assessment/sessions` test posts `{"studentId":"student_b"}` while
signed in as A and asserts the session belongs to A.

## Tests

| Check | Command | Result |
|---|---|---|
| Lint | `npx eslint src` | **PASS** — exit 0, no warnings |
| Typecheck | `npx tsc --noEmit` | **PARTIAL** — 8 errors, **all** in `src/lib/server/auth/gateway.ts` (7) and `gateway.test.ts` (1); **0 errors anywhere else**, including all new code |
| Unit + integration | `npx vitest run` | **432 passed / 0 failed**, 33 files. 1 suite cannot be *collected*: `gateway.test.ts` |
| Build | `npx next build` | **BLOCKED** — `next/font` cannot reach `fonts.googleapis.com` (ECONNRESET) |
| `prisma generate` | `npx prisma generate` | **BLOCKED** — `binaries.prisma.sh` unreachable |

Baseline before Phase 1 was **400 passed / 2 failed** (both in
`assessment-intro.test.tsx`). Step 1a took it to **405 / 0**; the engine work
takes it to **432 / 0** — a net **+32 passing tests** against the original
baseline, **+27** against the post-1a state.

**Why the 8 typecheck errors and the uncollectable suite are environmental, not
code defects.** All 8 trace to `@prisma/client` never having been generated:
`Module '"@prisma/client"' has no exported member 'User'`,
`Property 'PrismaClientKnownRequestError' does not exist on type 'typeof Prisma'`,
and five `TS7006` implicit-`any` errors that follow from those missing types.
`gateway.test.ts` fails at collection with
`@prisma/client did not initialize yet. Please run "prisma generate"`.
`prisma generate` cannot run here — `binaries.prisma.sh` is blocked and
Prisma 6.19.3 has no WASM code path (`grep wasm` over
`@prisma/fetch-engine/dist/*.js` returns nothing). These are **not** papered
over with type shims or file exclusions.

**Verification that the typecheck result is real.** `tsc` covers
`**/*.ts` per `tsconfig.json`. Probed by injecting
`const __probe: number = "not a number"` into
`src/app/api/assessment/results/latest/route.ts`: `tsc` reported
`error TS2322` at line 21. After restoring the file, zero errors for that path.

**The 8 typecheck errors are pre-existing** — the same 8 were present in the
Phase 0 baseline.

### New regression coverage

`src/services/ownership-isolation.test.ts` (14) — B never receives A's active
session; a foreign session is 404 not 403; every mutating call from a non-owner
is rejected and leaves the owner's session untouched; A's diagnosis is never
B's latest result; scoring data never appears in the client projection; a
smuggled `correct: true` changes nothing; a correct answer **is** graded as a
strength (the control); goals, roadmaps and executions are isolated too.

`src/app/api/assessment/assessment-routes.test.ts` (12) — the real route
handlers, real `withStudent`, real `errorResponse`, real Zod schemas; only the
Prisma-backed gateway is faked. Anonymous → 401; guardian → 403; a crafted
`studentId` in the body is ignored; malformed profile → 400; the response body
contains the question and its option text but never `correctOptionId`,
`keywords` or `minMatches`; B gets 404 on A's session, answers, pause and
results; body/URL mismatch → 400.

**Anti-vacuity check.** The answer-key test was mutated twice: answering the
*correct* option instead of the wrong one made it fail
(`expected [] to include 'closures'`), and replacing the expected topic made it
fail. The test bites.

## Remaining Risks

1. **Typecheck is not at zero and cannot be here.** The 8 `gateway.ts` errors
   mean the auth core is not type-verified in this sandbox. It must be
   re-run in an environment with `prisma generate` before Phase 2 merges.
2. **`next build` is unverified.** The font fetch fails before compilation
   finishes. Route handlers are type-checked (proven above) but not
   bundle-checked.
3. **The 1b PostgreSQL migration rewrite is unexercised.** No PostgreSQL server
   exists in this sandbox, so `prisma migrate deploy` against the rewritten DDL
   has never run. The 16 `gateway.test.ts` tests are still unrun.
4. **Rate limiting is in-memory.** `checkRate` is a per-process sliding window
   and does not coordinate across instances. Correct for a single-instance
   modular monolith; a real deployment behind multiple instances needs a shared
   counter. Phase 6.
5. **403/404 inconsistency is live.** Goals answer 403 for a non-owner;
   assessment and roadmaps answer 404. A 403 confirms the resource exists.
   Deliberately preserved this phase; must be unified in Phase 3.
6. **`TestResultAnswer.correct` is still client-supplied** in the module-test
   flow. `src/features/quizzes/components/test-runner.tsx:71` computes
   `choices[q.id] === q.correctChoiceIndex` in the browser and posts the
   verdict; `TestResultAnswer.correct: boolean` is declared at
   `src/types/domain.ts:187`. The same defect class fixed for assessment is
   still open here. `testService` has no HTTP endpoint (`mockRequest` only),
   so it is not remotely exploitable today — but it must be server-graded
   before it gets one.
7. **The mock adapter is still the production runtime for goals, roadmaps and
   executions.** `USE_MOCK = true` is hardcoded in `src/lib/api/client.ts`.
   Persistence is Phase 2.
8. **No CI.** `.github/` does not exist, so none of the above is enforced on
   merge. Phase 8.

## Deferred Decisions

| Decision | Why deferred | Recommended |
|---|---|---|
| Unify non-owner responses on 404 | Changing goal 403 → 404 is a public API contract change; 4 assertions depend on the current behaviour | Adopt 404 everywhere in Phase 3 — existence must not leak |
| `GoalCreationContext.diagnosisContext` supplied by the caller vs. fetched by the engine | Fetching inside `createGoal` would make it async and churn 30 goal tests for no gain | Keep caller-supplied; the application layer resolves it via `AssessmentResultSource` |
| Assessment status state machine | Assessment status is inline `if` checks, unlike the three tested state machines | Extract in Phase 4 with the rest of the learning engines |
| Prisma models for the learning domain | §43.10 — do not redesign the database in Phase 1 | Phase 2, after asking per type whether it is a real entity or a DTO |
| Structured logging | Premature before functionality stabilizes | Phase 8 |
| Deleting verified-orphaned i18n keys | 8 keys confirmed unused and **still present** in `en.ts`/`ar.ts` (`introBody`, `adaptiveNote`, `whatToExpect`, `begin`, `estimatedTime`, `estimatedMinutes`, `notStartedTitle`, `notStartedBody`), but several *apparent* orphans resolve through dynamic `t(\`…\`)` and must be kept | Delete only those 8, in a dedicated cleanup pass, re-running `grep -rn 't(\`'` first |

## Phase 2 Readiness

**Ready.**

- The seams Phase 2 needs already exist and are exercised: four store ports
  plus three lookup ports, with memory and localStorage adapters behind them.
  A `PrismaGoalStore` is a drop-in replacement for `GoalStore` — no engine
  changes, no service changes, one line in `src/services/engines.ts`.
- The domain provably does not know about the adapters: zero browser APIs, zero
  Prisma imports, zero HTTP inside the engines.
- Prisma configuration is consistent on PostgreSQL across `schema.prisma`,
  `migration_lock.toml`, the migrations and `.env.example`; the Supabase layer
  is gone.
- Ownership is enforced above the persistence layer, so a repository swap
  cannot silently drop it — 26 regression tests would fail if it did.

**Blocked until the environment allows:** `prisma generate`, `prisma migrate
deploy`, and therefore the 16 `gateway.test.ts` integration tests.

**Phase 2 entry criteria:** an environment where `prisma generate` succeeds and
a disposable PostgreSQL is reachable; then re-run `tsc --noEmit` (expect 0) and
`vitest run` (expect 448).

PHASE 1 STATUS: PARTIAL
