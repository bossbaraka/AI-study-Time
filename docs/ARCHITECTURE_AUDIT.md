# Mureeh Study Assistant — Phase 0 Read-Only Architectural Audit

**Repository:** `bossbaraka/AI-study-Time`
**Commit audited:** `d8f177dec8543263f62dbc5eaabdad04086185eb` (`feat: initial commit for Mureeh AI study assistant platform with Neon DB & AI question generation`)
**Branch:** `arena/01a0e78e-ai-study-time`
**Date:** 2026-09-28
**Mode:** READ-ONLY. Zero existing files modified (`git status --short` → empty). Zero files deleted. This document is the only file added.

---

## 0. Verification baseline (commands actually run in this audit)

Every number below came from a command executed against this checkout. Nothing is estimated.

| Command | Result |
| --- | --- |
| `npm install --no-audit --no-fund` | OK — 546 packages |
| `npm run lint` (`eslint src`) | **PASS** — exit 0, no output |
| `npm run test` (`vitest run`) | **FAIL** — `Test Files 2 failed \| 29 passed (31)`, `Tests 2 failed \| 400 passed (402)` |
| `npm run typecheck` (`tsc --noEmit`) | **FAIL** — exit 2, 8 errors |
| `npm run build` (`next build`) | **FAIL — environmental only** (see below) |
| `npx prisma generate` | **FAIL — environmental only** (see below) |

### The two environmental blockers (stated honestly, not hidden)

1. **`npx prisma generate` cannot run here.** It needs `https://binaries.prisma.sh/...schema-engine.gz` and this sandbox has no route to that host (`ECONNRESET`). Consequence: `node_modules/.prisma/client/index.d.ts` is the **110-line unpublished stub** (verified: `wc -l` → 110; `grep UserGetPayload` → no match). This is the *sole root cause* of all 8 typecheck errors and of the `gateway.test.ts` collection failure. **On a machine with normal network access these two would very likely pass.** I could not verify that, and I am marking it as unverified.

2. **`next build` cannot run here.** `src/app/layout.tsx:2` imports `IBM_Plex_Sans_Arabic, Noto_Kufi_Arabic` from `next/font/google`; the build fetches them from `fonts.googleapis.com`, which is unreachable. Failure is `Failed to fetch 'IBM Plex Sans Arabic' from Google Fonts` — **not** a code defect. Side note worth carrying into Phase 8: `next/font/google` makes the build depend on an external host; a build-time font cache or self-hosting removes that fragility.

### The two failures that are *real*, not environmental

| Failure | Evidence | Verdict |
| --- | --- | --- |
| `src/features/assessment/components/assessment-intro.test.tsx` — 2 of 4 tests fail | Reproduces **in isolation**: `npx vitest run src/features/assessment/components/assessment-intro.test.tsx` → `2 failed \| 2 passed (4)`. Test looks for `heading /where you are before deciding…/` and `button "Begin assessment"`. The component no longer renders either: `grep "assessment.begin\|assessment.why\|assessment.adaptiveNote\|assessment.expectDiagnosis" assessment-intro.tsx` → **no matches**; the CTA is now `t("assessment.discovery.generateCta")` (line 307). | **Genuine test/code drift.** The component was rewritten into the "AI-Powered Diagnostic Customization" discovery screen and the test was never updated. 4 i18n keys are now orphaned (`en.ts:198,200,201,203` — present, unreferenced). |
| `src/lib/server/auth/gateway.test.ts` — file fails to collect | `new PrismaClient node_modules/.prisma/client/default.js:43` at `gateway.test.ts:14`. Its **16 `it()` blocks never executed** (390 `it()` declarations in the repo vs 402 collected — the 16 here are excluded). | Environmental *today*, but see §5: the suite is **also** mis-configured against the current schema, so it would fail even with a generated client. |

**Read this before anything else:** the repo's own gate is currently red on `typecheck` and `test`. Phase 1 cannot start from a red baseline — restoring green is the first deliverable, before any architecture moves.

---

## 1. Architecture Status

Scale used throughout — **REAL** (production path exists and is exercised), **PARTIAL** (real logic, mock persistence/transport), **MOCK** (simulated end-to-end), **MISSING** (no implementation).

| Domain | Current State | Production State required | Gap |
| --- | --- | --- | --- |
| **Authentication** | **REAL** (server) / MOCK (tests) | REAL | Real gateway: scrypt, hashed session tokens, invitation-only registration, DB lockout, audit trail, Prisma persistence. Gap: rate limiter is in-memory single-instance; no CI proves the suite runs; migration cannot deploy (§5). |
| **Admin portal** | **REAL** | REAL | Complete: 9 routes, `withAdmin` wrapper, CSRF check, role gate, no mock branch at all. Genuinely the most production-shaped area. |
| **Assessment** | **PARTIAL** | REAL | Adaptive selection, scoring, diagnosis synthesis are real, deterministic, well-tested (22 cases). Persistence is `localStorage`; sessions have **no `studentId`** — `getActiveSession()`/`getLatestCompletedResult()` are global to the browser, not per-student. |
| **Question bank** | **PARTIAL** | REAL | Static bank (server-owned scoring, correct) **+** AI-generated bank whose **scoring is shipped to the browser** (§3, P0). No `QuestionValidator`, no bank persistence, no dedupe/quality gate. |
| **Diagnosis** | **PARTIAL** | REAL | `synthesizeResult()` is real and honest (confidence tiers by coverage). It is *recomputed on every read*, never persisted — so "latest diagnosis" is derived, not a record. |
| **Goal** | **PARTIAL** | REAL | Strongest domain logic in the repo: pure validation, documented hours heuristic, real state machine (8 cases), idempotent create + lock. Persistence is `localStorage`. |
| **Goal locking** | **PARTIAL** | REAL | Correct ordering (validate → assert transition → persist → report). Needs a DB transaction + a unique constraint to be真 atomic. |
| **Roadmap** | **PARTIAL** | REAL | Excellent: capability selection, diagnosis weighting, Kahn topological sort, cycle rejection, time budgeting, structural quality gate, idempotent generation key, 32 tests. Planner is *nearly* pure — it still reads goals through `mockGoalEngine` and writes `localStorage`. |
| **Mission execution** | **PARTIAL** | REAL | Execution engine over learning units is real: dependency gating, retry edge, idempotent start, deterministic evaluator, 29 tests. Note: this is `LearningUnitExecution`, **not** the legacy `Mission`. |
| **Mission (legacy)** | **MOCK** | REAL | `missionService.setState(state)` accepts **any** `MissionState` with no transition table (verified: no `TRANSITIONS` for `MissionState`). `tick()` overwrites `elapsedSeconds` from client input. |
| **Recall** | **MOCK** | REAL | `recallService.answer()` = `intervalDays × {2.2, 1.4, 0.6}` on **self-rated** confidence; `dueToday` is a boolean, not a due date. No SRS, no per-student data, no persistence. |
| **Testing (module tests)** | **MOCK** | REAL | **The browser declares correctness.** `test-runner.tsx:71` computes `choices[q.id] === q.correctChoiceIndex` and sends `correct: boolean` to the service. `correctChoiceIndex` is present in `mocks/data.ts` (4 occurrences) and reaches the client. |
| **Mastery** | **MOCK** | REAL | `masteryService.list()` → `clone(db.mastery)` — a hardcoded 2-element array. `achieved: true/false` is literal data. **No evidence engine exists.** The `MasteryEvidence` shape (`kind/score/threshold/state`) is a good contract with nothing computing it. |
| **Recovery** | **MOCK** | REAL | `advanceStep(step)` accepts any step, no transition guard, no trigger logic. `recoveryService.getActive()` returns one hardcoded plan. |
| **Behavior** | **MOCK** | REAL | `behaviorService.getProfile()` → `clone(db.behavior)`. Hardcoded percentages (`learningSpeed`, `comprehension`, `focus`, …) presented as measurement. |
| **AI Mentor** | **MOCK** | REAL | `composeContextualReply()` = 6 `if (q.includes(...))` string branches. No provider, no context builder, no policy validation. |
| **Achievements / Certificates** | **MOCK** | REAL | Static arrays; `changeTier()` mutates `db.student` in memory. |
| **Notifications / Subscription / Guardian** | **MOCK** | REAL | Static arrays, in-memory mutation only. |
| **Student profile** | **MOCK** | REAL | `studentService.getCurrent()` → `clone(db.student)`; unrelated to the authenticated `User` row. |
| **AI infrastructure** | **MISSING** | REAL | No `AIProvider` interface. One direct `fetch` to Gemini inside a route file. No schema validation, timeout, retry, token budget, logging, or fallback contract. |
| **Persistence layer** | **MISSING** | REAL | **No repository interface exists anywhere** (verified: `grep "interface .*Repository" src/` → empty). One Prisma usage site (`lib/server/db.ts` → auth gateway only). |
| **API surface** | **PARTIAL** | REAL | 19 route files exist. **~25 endpoints referenced by services do not exist** (§3). |
| **E2E** | **MISSING** | REAL | No E2E runner, no test, no config. |
| **CI** | **MISSING** | REAL | No `.github/` directory (verified). Nothing runs typecheck/lint/test automatically — which is exactly how the red baseline survived. |

---

## 2. Dependency map (per domain, as traced)

```
DOMAIN              UI                          HOOK                        SERVICE                      DOMAIN LOGIC                     INFRASTRUCTURE
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
Auth                features/auth/*             use-auth                    auth.service                 lib/server/auth/gateway          Prisma → Postgres  ✅ REAL
                    (login/register/reset)      use-auth-actions                                          password / rate-limit
Admin               app/(admin)/admin/*         use-admin                   admin.service                lib/server/auth/gateway          Prisma → Postgres  ✅ REAL
Assessment          assessment-intro            use-assessment              assessment.service           mock-assessment-engine           window.localStorage ⚠️
                                                (+ direct fetch)                                          question-bank
                                                                                                          lib/server/ai/question-generator Gemini (direct fetch)
Goal                goal-discovery-flow         use-goal-discovery          goal-discovery.service       mock-goal-engine                 window.localStorage ⚠️
                                                                                └─ session-guard → auth.service → /api/auth/session  ✅ (real identity)
Roadmap             roadmap-flow                use-roadmap                 roadmap.service              mock-roadmap-engine              window.localStorage ⚠️
                                                                                    │                     curriculum / graph / state-machine
                                                                                    └──────────────────→  mock-goal-engine  (hard import)
Execution           unit-learn-flow             use-execution               execution.service            mock-execution-engine            window.localStorage ⚠️
                    learn-index-flow                                          │                           development-evaluator
                                                                              └────────────────────────→ execution-projection
                                                                                    └──────────────────→ mock-roadmap-engine (hard import)
Dashboard/Goal(lg)  app/(student)/app/*         use-journey                 journey.service              active-goal-projection           mock-db (in-memory) ❌
                                                                                                          └→ mock-goal-engine
Learning            app/mastery, /recall, /tests use-learning               learning.service             — (logic inline in service)      mock-db (in-memory) ❌
Engagement          /achievements,/certificates, use-engagement             engagement.service           —                                mock-db (in-memory) ❌
                    /notifications,/subscription
Intelligence        /behavior,/insights,/mentor, use-intelligence           intelligence.service         composeContextualReply (strings) mock-db (in-memory) ❌
                    /recovery,/profile,/progress
Guardian            app/(guardian)/guardian     use-engagement              engagement.service           —                                mock-db (in-memory) ❌
```

### The structural observation that matters most

There is a **hard import chain** between engines, with no seam in between:

```
mock-execution-engine ──imports──▶ mock-roadmap-engine ──imports──▶ mock-goal-engine ──imports──▶ mock-assessment-engine
   activeRoadmapFor()                  loadLockedGoal()                diagnosisContext:
                                                                          getLatestCompletedResult()
```

Verified:
- `mock-execution-engine.ts` → `import { mockRoadmapEngine }` → `activeRoadmapFor()` calls `mockRoadmapEngine.getActiveRoadmap(studentId)`
- `mock-roadmap-engine.ts` → `import { mockGoalEngine }` → `loadLockedGoal()` calls `mockGoalEngine.getGoal(goalId, studentId)`
- `mock-goal-engine.ts` → `import { mockAssessmentEngine }` → `diagnosisContext: mockAssessmentEngine.getLatestCompletedResult()`

**This is the single highest-leverage thing to fix, and it is good news:** the *domain logic* on both sides of each arrow is already pure and already tested. Only the arrows themselves are wrong. Introducing three repository interfaces (`GoalRepository`, `RoadmapRepository`, `AssessmentResultRepository`) breaks the chain without touching one line of planning, validation, or state-machine logic.

**Credit where due** — the codebase already respects most boundaries the brief asks for:
- Ownership is resolved from the session, never from client input (`session-guard.ts`, and every engine takes `studentId` as a parameter).
- Foreign and missing ids collapse to the same 404 (`ownGoal`, `ownRoadmap`, `resolveUnit`) — no existence leak.
- Idempotency keys on create/lock/generate, with real replay tests.
- Three pure, table-driven state machines with negative tests.
- Typed error funnels per domain (`toGoalError`, `toRoadmapError`, `toExecutionError`) — the HTTP seam will not need error redesign.
- The roadmap planner has a structural quality gate that refuses to emit a partially valid plan.
- `development-evaluator.ts` is exemplary honesty: it returns `needs_review` rather than inventing a pass, and says so in its own docstring.

The mocks are **not** the problem. The absence of a seam *under* them is.

---

## 3. Critical Risks

Ordered by blast radius. No cosmetic ratings.

### P0 — blocks production, must fix before any real user

**P0-1 · The browser declares test correctness.**
`src/features/quizzes/components/test-runner.tsx:71` → `choices[q.id] === q.correctChoiceIndex`; line 80 → sends `correct: gradeChoice(q)`. `TestResultAnswer.correct: boolean` (`types/domain.ts:187`) is **client-supplied**. `correctChoiceIndex` ships to the client (`mocks/data.ts`, 4 occurrences). `learning.service.ts` then "grades" using the client's own verdict and derives `recommendation` (including `recovery-session`) from it.
*Effect:* the entire Measure → Correct → Master arc is forgeable with one devtools edit. Any mastery/recovery decision downstream inherits it.

**P0-2 · AI-generated assessment answer keys are sent to the browser.**
`/api/assessment/generate` returns `{ bank: BankItem[], topics }` (`route.ts:26`), and `BankItem.scoring` contains `correctOptionId` / `keywords` / `minMatches` (`question-generator.ts:121-138`). `assessment.service.ts:createSession` performs this `fetch` **from the browser**. The static `QUESTION_BANK` is correctly protected — its own header documents "scoring keys … NEVER included in the AssessmentQuestion objects handed to the UI (§37)" — and `toClientSession` does strip scoring. The AI path bypasses that rule entirely.
*Effect:* for any AI-generated session, every correct answer is in the network response. The assessment — the foundation of diagnosis, goal, and roadmap — is fully gameable.

**P0-3 · ~25 service endpoints have no implementation.**
Verified by diffing service call sites against `src/app/api`. Existing: `/api/health`, `/api/auth/*` (8), `/api/admin/*` (9), `/api/assessment/generate` = 19 route files. Referenced but absent: `/api/assessment/sessions` (+`/active`, `/{id}`, `/answers`, `/pause`, `/resume`, `/complete`, `/results`), `/api/assessment/results/latest`, `/api/goals` (+`/active`, `/{id}`, `/lock`, `/revise`, `/validation`), `/api/roadmaps` (+`/active`, `/generate`, `/{id}`, `/pause`, `/resume`), `/api/executions/view` (+`/units/{id}/context|start|evidence|evaluate`).
*Effect:* `USE_MOCK = false` is **not a switch** — it is a cliff. Every domain operation 404s. The README's "3-step swap" is not currently true, and should not be attempted before Phase 3.

**P0-4 · Assessment sessions are not scoped to a student.**
`mockAssessmentEngine.createSession/getActiveSession/getLatestCompletedResult` take **no `studentId`** (contrast: goal/roadmap/execution engines all take one). State lives in one shared `localStorage` key `mureeh.mock.assessment.v1`. `createSession` also expires *every* unfinished session it finds.
*Effect:* on a shared device, student B resumes student A's assessment, and B's goal inherits A's diagnosis via `diagnosisContext`. This is the one domain where the repo's otherwise-consistent ownership discipline is missing — and it sits at the head of the whole pipeline.

**P0-5 · The red baseline itself.**
`typecheck` fails (8 errors) and `test` fails (2 files) on a clean clone with no local changes. With no CI, nothing detects this. *Effect:* no phase can be validated, so no phase can be trusted. Fix first.

### P1 — serious, fix in the same programme

**P1-1 · Schema and migration disagree; the migration cannot deploy.**
`prisma/schema.prisma` → `provider = "postgresql"`. `prisma/migrations/migration_lock.toml` → `provider = "sqlite"`. `migration.sql` contains **12 `DATETIME` columns** (verified count) — not a Postgres type. `prisma migrate deploy` against Postgres fails on `type "datetime" does not exist`. The schema's own header comment still reads "SQLite via Prisma. Swap for Postgres later" — the swap happened, the comment and the migration did not follow.
*Also:* `src/test/test-env.ts` sets `DATABASE_URL ??= file:.../prisma/data/test.db` (a SQLite path) while the schema is Postgres, and `gateway.test.ts`'s docstring says "REAL SQLite (prisma/data/test.db)". Three places believe SQLite; one believes Postgres.

**P1-2 · `/api/assessment/generate` is unauthenticated and unvalidated.**
Verified: no `serverUser`, `requireAdminApi`, `readSessionToken`, or `csrfRejected` in the route. Any anonymous client can trigger a paid Gemini call, with no rate limit. Input handling is hand-rolled (`typeof body.targetSubject !== "string"`, `age > 4 ? age : 16`) — **no Zod schema**, unlike `schemas/auth.ts`, `schemas/goal.ts`, `schemas/assessment.ts` which are properly validated. No length cap on `targetSubject`, which is interpolated verbatim into the Gemini prompt → prompt-injection surface.

**P1-3 · Domain logic is bound to a browser API.**
All five engines call `window.localStorage` directly (`mock-assessment-engine.ts:113,127`, `mock-goal-engine.ts:126,140`, `mock-roadmap-engine.ts:93,107`, `mock-execution-engine.ts:57,71`, `mock-auth-backend.ts:111,125`). *Effect:* none of this domain logic can run in Node — so it cannot move server-side, and cannot be integration-tested against a database, without first extracting storage behind an interface. This is the mechanical blocker under P0-3.

**P1-4 · No persistence for the learning loop at all.**
Goals, roadmaps, executions, assessments exist only in the student's browser. Clearing site data erases a student's entire learning history. Nothing is recoverable, auditable, or analysable. Multi-device is impossible.

**P1-5 · Mastery, Recovery, and Behavior are asserted, not derived.**
`masteryService.list()` returns a hardcoded array whose `achieved` flags are literals. `recoveryService.advanceStep()` has no transition guard and no trigger. `behaviorService.getProfile()` returns invented percentages rendered as measurement on `/app/behavior` and `/app/progress`. The README's flagship claim — "Mastery 🧠 Evidence grid: completion ≠ mastery" — is currently a *UI* that displays static data, not a system that computes evidence.

**P1-6 · Single-instance rate limiting.**
`lib/server/auth/rate-limit.ts` is an in-memory `Map`; its own docstring admits it. Behind more than one replica, per-window limits are per-replica. The DB-backed per-account lockout still holds, so this is P1 rather than P0.

### P2 — should fix, not blocking

- **P2-1 · No CI.** No `.github/`. The direct cause of P0-5 surviving into `main`.
- **P2-2 · Dead Supabase layer.** `lib/supabase/client.ts` and `lib/supabase/server.ts` exist, `@supabase/supabase-js` is a runtime dependency, and **nothing imports them** (verified). `.env.example` documents 3 Supabase variables while `schema.prisma` points at a plain `DATABASE_URL`. Two competing persistence stories; pick one.
- **P2-3 · Orphaned i18n keys.** `assessment.intro`, `assessment.why`, `assessment.adaptiveNote`, `assessment.expectDiagnosis`, `assessment.begin` exist in both dictionaries, unreferenced — the residue of the rewrite that broke the test.
- **P2-4 · Legacy `Mission` has no state machine** while three sibling domains do. `setState` accepts any state; `tick(elapsedSeconds)` trusts the client.
- **P2-5 · Diagnosis is recomputed, never stored.** `synthesizeResult()` runs on every `getResults`/`getLatestCompletedResult`. Deterministic today, but there is no `AssessmentResult` record to point a roadmap's `generationContext.diagnosisSessionId` at.
- **P2-6 · Duplicate `Roadmap` types.** `types/domain.ts` (`phases`/`modules`) vs `types/roadmap.ts` (`milestones`/`learningUnits`). The newer file documents the divergence; it still needs resolving.
- **P2-7 · `next/font/google` build-time external dependency** (see §0).

### P3 — track

- P3-1 · `console.warn/error` instead of structured logging (`assessment.service.ts`, `question-generator.ts`, `request.ts`).
- P3-2 · Gemini model hardcoded in a URL (`gemini-1.5-flash`), no model configuration.
- P3-3 · `clone()` via `structuredClone`/JSON round-trip as a boundary defence — fine, but a repository layer makes it unnecessary.
- P3-4 · `mockRequest`'s artificial latency is coupled to `appConfig.mockLatency` in a module the real client also imports.

---

## 4. Mock Dependency Map

Exact locations, with the required classification.

### 4.1 `mockRequest` — the transport seam (`lib/api/client.ts`)

| Consumer | `mockRequest` | `httpRequest` | Classification |
| --- | --- | --- | --- |
| `admin.service.ts` | 0 | 12 | ✅ Already real — no mock branch by design |
| `auth.service.ts` | 9 | 9 | **Safe for tests** — `AUTH_USE_GATEWAY = !process.env.VITEST` already routes the app to the real gateway |
| `assessment.service.ts` | 10 | 10 | **Must be replaced** (endpoints missing — P0-3) |
| `goal-discovery.service.ts` | 2 | 8 | **Must be replaced** |
| `roadmap.service.ts` | 2 | 6 | **Must be replaced** |
| `execution.service.ts` | 2 | 6 | **Must be replaced** |
| `journey.service.ts` | 12 | 1 | **Must be replaced** — the `1` is indirect, via `active-goal-projection` → `auth.service` |
| `learning.service.ts` | 11 | **0** | **Must be replaced** — no HTTP branch exists at all |
| `intelligence.service.ts` | 7 | **0** | **Must be replaced** — no HTTP branch exists at all |
| `engagement.service.ts` | 9 | **0** | **Must be replaced** — no HTTP branch exists at all |

Note the asymmetry: goal/roadmap/execution/assessment already have their `viaHttp` branches written and error-mapped. `learning`, `intelligence`, and `engagement` have **zero** — those three need contracts designed, not just implemented.

### 4.2 `mock-db` — the in-memory store

Imported by exactly **4** files (verified):

```
src/services/mock-db.ts        ← sole importer of @/mocks/data
  ├── src/services/journey.service.ts        (student, goal, roadmap, dailyPlan, mission)
  ├── src/services/learning.service.ts       (resources, recall, tests, mastery)
  ├── src/services/intelligence.service.ts   (behavior, recovery, mentor)
  └── src/services/engagement.service.ts     (achievements, certificates, notifications, plans, guardian)
```

Classification: **Must be replaced for production.** It is a module-level mutable singleton (`export const db = { … }`) — shared across all users in one server process, reset on every reload, never persisted. It is *not* safe even as a test double in its current form, because it holds no `studentId` on any entity.

### 4.3 `localStorage` — engine persistence

| File | Lines | Key | Classification |
| --- | --- | --- | --- |
| `services/assessment/mock-assessment-engine.ts` | 113, 127, 572 | `mureeh.mock.assessment.v1` | **Must be replaced** (P0-4: not student-scoped) |
| `services/goals/mock-goal-engine.ts` | 126, 140, 650 | `mureeh.mock.goals.v1` | **Must be replaced** |
| `services/roadmap/mock-roadmap-engine.ts` | 93, 107, 689 | `mureeh.mock.roadmaps.v1` | **Must be replaced** |
| `services/execution/mock-execution-engine.ts` | 57, 71, 323 | `mureeh.mock.executions.v1` | **Must be replaced** |
| `services/auth/mock-auth-backend.ts` | 111, 125, 312 | (mock auth) | **Safe for tests** — `AUTH_USE_GATEWAY` already excludes it from the app |
| `lib/i18n/provider.tsx` | 47, 70 | `mureeh.locale` | **Development-only / legitimate** — a UI preference, correctly client-side. Leave it. |

All five engine stores follow one identical pattern (`loadX()` / `saveX()` / `__reset()`, guarded `try/catch`, memory fallback). That uniformity is an asset: one storage interface replaces all five with a mechanical change.

### 4.4 Hardcoded demo data (`src/mocks/data.ts`, 766 lines)

Reached **only** through `mock-db.ts` — a clean single choke point. 19 `export const mock*` values:

| Value | Consumed by | Surfaced at | Classification |
| --- | --- | --- | --- |
| `mockStudent` | `studentService.getCurrent` | `/app/profile`, `/app/settings` | **Must be replaced** — unrelated to the real `User` row |
| `mockGoal` | `goalService.getCurrent` fallback | `/app/goal`, sidebar, `/app` | **Must be replaced** — see note below |
| `mockRoadmap` | `roadmapService.getCurrent` | (legacy bridge only) | **Development-only** — `/app/roadmap` now redirects to `/roadmap` |
| `mockMastery` | `masteryService.list` | `/app/mastery` | **Must be replaced** (P1-5) |
| `mockBehavior` | `behaviorService.getProfile` | `/app/behavior`, `/app/progress`, `/app/insights` | **Must be replaced** (P1-5) |
| `mockRecoveryPlan` | `recoveryService.getActive` | `/app/recovery` | **Must be replaced** (P1-5) |
| `mockTests`, `mockTestResult` | `testService.*` | `/app/tests` | **Must be replaced** (P0-1) |
| `mockRecallCards`, `mockRecallStats` | `recallService.*` | `/app/recall` | **Must be replaced** |
| `mockMission`, `mockDailyPlan` | `missionService`, `dailyPlanService` | `/app`, `/app/mission` | **Must be replaced** |
| `mockMentorContext`, `mockMentorMessages` | `mentorService.*` | `/app/mentor` | **Must be replaced** (Phase 5) |
| `mockAchievements`, `mockCertificates` | `achievementService`, `certificateService` | `/app/achievements`, `/app/certificates` | **Must be replaced** |
| `mockNotifications`, `mockPlans`, `mockGuardianSummary`, `mockResources` | respective services | `/app/notifications`, `/app/subscription`, `/guardian`, `/app/learning` | **Must be replaced** |

**Important nuance on `mockGoal`:** `active-goal-projection.ts` already does the right thing — it prefers the student's real locked goal and uses `mockGoal` only as a fallback. That projection is the correct migration shape and should be the template for the other dashboard surfaces, not something to rewrite.

### 4.5 Mock engines

| Engine | Domain logic | Persistence | Classification |
| --- | --- | --- | --- |
| `mock-assessment-engine` | Real, 22 tests | localStorage | **Logic: keep. Storage: replace.** |
| `mock-goal-engine` | Real, 30 tests | localStorage | **Logic: keep. Storage: replace.** |
| `mock-roadmap-engine` | Real, 32 tests | localStorage | **Logic: keep. Storage: replace.** |
| `mock-execution-engine` | Real, 29 tests | localStorage | **Logic: keep. Storage: replace.** |
| `mock-auth-backend` | Simulated | localStorage | **Safe for tests** — already excluded from the app |

This is the most important row in the audit: **113 test cases sit on top of real, deterministic domain logic whose only production defect is where it stores data.** Do not rewrite these engines.

---

## 5. Database Gap

### Current Prisma schema (6 models — auth only)

| Model | PK | FKs | Indexes | Unique | Lifecycle | Assessment |
| --- | --- | --- | --- | --- | --- | --- |
| `User` | `id` cuid | — | — | `email`, `nationalId` | `pending→active\|suspended` | Sound. `role`/`status`/`emailVerification`/`onboarding` are free `String` — should be enums. No soft delete (acceptable: `status` covers it). |
| `Session` | `id` | `userId`→User, cascade | `userId` | `tokenHash` | TTL, revocable | **Good design** — only SHA-256 stored. Missing an index on `expiresAt` for cleanup. |
| `Invitation` | `id` | `invitedById`, `acceptedById` | `status` | `code` | `pending→accepted\|revoked` | Sound. |
| `PasswordResetToken` | `id` | `userId`, cascade | — | `tokenHash` | single-use, 1h | Sound. Missing index on `userId`. |
| `AuditEvent` | `id` | `userId`, `actorId`, SET NULL | `createdAt` | — | append-only | Sound. Consider `type` index. |
| `OutboxMessage` | `id` | — | `createdAt` | — | dev stand-in | Honest: documented as an email-gateway placeholder. |

**Only one `$transaction` in the entire codebase** (verified): `gateway.ts:398`, in `resetPassword` — correctly bundling password update + token consumption + session revocation. Good instinct, applied once.

### Required production domain (proposed — deliberately *not* one model per TypeScript interface)

The brief's rule applies: an entity earns a table only if it has a real lifecycle. Applying it:

**Tier 1 — real entities, needed for the core loop (Phase 2)**

| Model | Why it is an entity, not a DTO | Key decisions |
| --- | --- | --- |
| `StudentProfile` | 1:1 with `User`, own lifecycle (locale, timezone, onboarding progress) | PK `userId` (also FK, 1:1). Replaces `mockStudent`. |
| `Goal` | Draft→…→achieved lifecycle, versioned, locked | FK `studentId`. Unique `(studentId, createIdempotencyKey)` and `(studentId, lockIdempotencyKey)` — makes the existing idempotency **enforced by the DB**, not by a scan. Index `(studentId, status)`. Partial unique on "one active goal per student". `diagnosisContext` → FK to `AssessmentResult`. |
| `GoalEvent` | Auditability of transitions; the state machine already produces them | Append-only. FK `goalId`. Index `(goalId, createdAt)`. |
| `AssessmentSession` | Has a lifecycle (`in_progress/paused/completed/expired`) and a TTL | FK `studentId` — **fixes P0-4**. Index `(studentId, status)`. Unique on `(studentId, submissionId)` per answer for real idempotency. |
| `AssessmentAnswer` | One row per graded response; the evidence substrate | FK `sessionId`, `questionId`. Unique `(sessionId, submissionId)`. **Stores `points` server-side only.** |
| `AssessmentResult` | The diagnosis is a *record*, not a recomputation (P2-5) | FK `sessionId`, unique. Snapshot of strengths/gaps/confidence so a roadmap can point at the exact diagnosis it used. |
| `Roadmap` | Versioned plan with a lifecycle; history must be kept | FK `studentId`, `goalId`. **Unique `(studentId, goalId, goalVersion, engineVersion)`** = the existing `generationKey`, enforced. Index `(studentId, status)`. |
| `Milestone` | Ordered, dependency-bearing, own status | FK `roadmapId`. `order` unique per roadmap. Dependencies → `MilestoneDependency` join table (FK both ways) so the graph is queryable and cycle-checkable in SQL. |
| `LearningUnit` | The atom of execution; already has ids, order, evidence contract | FK `milestoneId`. Unique `(milestoneId, order)`. |
| `LearningUnitExecution` | The runtime record; already fully modelled in `types/execution.ts` | FK `studentId`, `roadmapId`, `learningUnitId`. **Unique `(roadmapId, learningUnitId)`** — the engine's "one execution per unit" rule becomes a constraint. |
| `Question` + `QuestionScoring` | The bank needs a home; scoring must never leave the server (P0-2) | `Question` client-safe. `QuestionScoring` **separate table, never selected by any client-facing query.** Index `(topic, difficulty)` for the adaptive selector. |

**Tier 2 — needed once the corresponding engine is built (Phase 4/5)**

`MasteryEvidence` (append-only evidence records: `kind`, `score`, `threshold`, `observedAt`, source FK — the substrate §7 needs) · `RecallCard` + `RecallReview` (real SRS needs `dueAt DateTime`, `intervalDays`, `easeFactor`, not a `dueToday` boolean) · `TestAttempt` (server-graded, fixes P0-1) · `RecoveryPlan` + `RecoveryStep` · `BehaviorEvent` (raw events; the profile becomes a projection) · `MentorConversation` + `MentorMessage`.

**Tier 3 — explicitly *not* tables**

`AssessmentProgress`, `RoadmapExecutionView`, `UnitLearningContext`, `GoalWithValidation`, `GoalValidationResult`, `UnitRef`, `GuardianSummary`, `AdminSummary`, all `*Row` types, `DailyPlan`. These are **projections and value objects** — the repo already computes them purely (`execution-projection.ts`, `active-goal-projection.ts`, `buildProgress`). Persisting them would duplicate truth. `Validation` may be *embedded* as JSON on `Goal` since it is recomputed deterministically, but it is not an entity. `Achievement`/`Certificate` are borderline: only promote them when there is a real awarding rule; today they are static content and a `json` seed would be more honest than two empty tables.

### Non-negotiable schema work regardless of tier

1. **Reconcile the provider (P1-1).** Regenerate the migration for Postgres: `TIMESTAMPTZ` not `DATETIME`, `migration_lock.toml` → `postgresql`, `CONSTRAINT … PRIMARY KEY` form, real `enum` types for `role`/`status`. Fix the stale schema header comment.
2. **Fix the test database story.** `test-env.ts` points at SQLite while the schema is Postgres. Either a throwaway Postgres (testcontainers / a `DATABASE_URL_TEST`) or an explicit second schema — but the three places claiming SQLite must stop claiming it.
3. **Ownership as a queryable invariant.** Every student-owned table carries `studentId` and is *always* fetched through it — the engines already do this in memory; the schema must make the alternative impossible.
4. **Transactions where the operation is genuinely multi-entity.** Exactly these, no more: *Complete Assessment* (session status + result + answers), *Lock Goal* (goal + GoalEvent), *Publish Roadmap* (supersede prior + insert roadmap/milestones/units/deps), *Submit Test* (attempt + answers + mastery evidence), *Record Mastery* (evidence + mastery state), *Trigger Recovery* (plan + steps + notification). Single-row writes (`pauseRoadmap`, `markRead`) must **not** be wrapped.

---

## 6. AI Gap

### Current AI (verified, complete inventory)

One file: `src/lib/server/ai/question-generator.ts` (330 lines). One call site: `/api/assessment/generate`. One consumer: `assessmentService.createSession`, from the browser.

```
Browser ──fetch("/api/assessment/generate")──▶ route (no auth, no validation)
                                                    │
                                    process.env.GEMINI_API_KEY || AI_API_KEY
                                                    │ present?
                                        ┌───────────┴───────────┐
                                     yes │                     │ no / <6 questions
                                        ▼                     ▼
                        fetch(gemini-1.5-flash)      generateDynamicFallback()
                        temp 0.3, JSON mime          8 hardcoded Arabic templates
                                        │                     │
                                        ▼                     ▼
                            JSON.parse(rawText)      deterministic bank
                            map → BankItem[]  ← ⚠️ includes scoring
                                        └───────────┬───────────┘
                                                    ▼
                                    NextResponse.json({ bank, topics })  → BROWSER
```

What exists: a prompt, one `fetch`, one `JSON.parse`, a length check (`bank.length >= 6`), and a genuine deterministic fallback. The fallback is a real strength — the product works with no API key at all.

What is missing, measured against the brief's own list:

| Requirement | Status |
| --- | --- |
| `AIProvider` abstraction | **MISSING** — no interface; the route hardcodes Gemini |
| `OpenAIProvider` / `MockAIProvider` behind it | **MISSING** — the "mock" is a fallback branch inside the same function, not a provider |
| Schema validation of LLM output | **MISSING** — a bare `as` cast on `JSON.parse`. A malformed `type` or `difficulty` flows straight into the bank. Zod is already a dependency and already used well in `src/schemas/*` |
| Timeout | **MISSING** — no `AbortSignal` on the Gemini `fetch`; a hung call holds the request open |
| Retry policy | **MISSING** — one attempt, then silent fallback |
| Token limits / budget | **MISSING** |
| Model configuration | **MISSING** — `gemini-1.5-flash` hardcoded in the URL string |
| Logging | **PARTIAL** — `console.warn/error` with raw response text |
| Fallback | **PRESENT** ✅ — and well designed |
| Domain never depends on the provider | **PARTIAL** — the domain (`mock-assessment-engine`) does not import Gemini, but it *does* accept an unvalidated `BankItem[]` from the client |
| Guardrails: LLM cannot change student state | **PRESENT by accident** ✅ — the LLM only ever produces questions. It cannot declare mastery, mutate a goal, or publish a roadmap, because no code path allows it. **This property must be preserved explicitly, not left to chance.** |

### Required AI architecture (Phase 5 shape)

```
                       ┌──────────────────────────┐
   domain ───────────▶ │  AIProvider (interface)  │
   (needs a shape,     │  generateStructured<T>(  │
    not a vendor)      │    req, schema: ZodType<T>│
                       │  ): Promise<T>           │
                       └────────────┬─────────────┘
                 ┌──────────────────┼──────────────────┐
                 ▼                  ▼                  ▼
          GeminiProvider     OpenAIProvider      MockAIProvider
                 └──────────────────┴──────────────────┘
                            │ timeout · retry · token cap
                            │ model config · structured logging
                            ▼
                    Zod schema validation  ◀── reject, then fallback
                            ▼
                    domain-safe value
```

Two named capabilities, kept separate from generation:

- **`QuestionGenerator`** — produces candidate items. May be AI.
- **`QuestionValidator`** — **new, and the single most important AI addition.** Structural rules before anything enters the bank: 4 distinct options, `correctOptionId` actually among them, keywords non-empty, `minMatches ≤ keywords.length`, valid `type`/`difficulty`/`topic`, prompt length bounds, no duplicate prompts. Cheap, deterministic, testable, and it converts "trust the model" into "verify the model".

And the mentor, per the brief — **not** a chat clone:

```
StudentState + RecentEvidence + CurrentGoal + CurrentMission + KnownWeaknesses + LearningHistory
        │
        ▼  ContextBuilder  ← token budget, minimal relevant slice, PII minimisation,
        │                     student input quarantined from instructions (injection resistance)
        ▼  AIProvider.generateStructured(responseSchema)
        ▼  PolicyValidation  ← may explain / suggest / encourage.
        │                       MAY NOT: declare mastery, unlock a unit, change a goal,
        │                       publish a roadmap, override authorization, invent evidence.
        ▼  Student
```

`composeContextualReply()` already embodies the right *idea* — it answers only from `MentorContext` and says "nothing I say will drift from your roadmap". Keep that contract; replace the six `if` branches with a provider call, and keep the current function as `MockAIProvider`'s mentor response so tests stay hermetic.

---

## 7. Testing Gap

### What exists — 31 files, 402 collected cases, 400 passing

| Layer | Files | Cases | Verdict |
| --- | --- | --- | --- |
| **Unit — pure domain** | `graph` (8), `goal-state-machine` (8), `roadmap-state-machine` (6), `execution-state-machine` (6), `execution-projection` (19), `development-evaluator` (6), `password` (6) | 59 | **Strong.** Transition tables have negative tests (`it.each` over forbidden edges). |
| **Unit — engines** | `mock-goal-engine` (30), `mock-roadmap-engine` (32), `mock-execution-engine` (29), `mock-assessment-engine` (22) | 113 | **Strong.** Idempotency, ownership, and transition rejection are all covered. |
| **Unit — schemas** | `schemas/auth` (16), `schemas/goal` (15), `schemas/assessment` (11) | 42 | Good. |
| **Service integration** | `auth.service` (24), `execution.service` (12), `goal-discovery.service` (7), `roadmap.service` (7), `active-goal-projection` (6) | 56 | Good error-funnel coverage. |
| **Component** | `login-form` (12), `require-auth` (8), `goal-discovery-flow` (14), `roadmap-flow` (14), `unit-learn-flow` (14), `assessment-runner` (6), `assessment-results` (6), `question-renderer` (5), `assessment-intro` (4) | 83 | Reasonable. **`assessment-intro` is the 2 failing cases.** |
| **Gateway integration** | `gateway.test.ts` (16) | 0 ran | **Broken** — collection failure (§0, §5). |
| **API integration** | — | **0** | **MISSING** |
| **E2E** | — | **0** | **MISSING** — no runner, no config, no test |
| **CI** | — | — | **MISSING** — no `.github/` |

### What is missing, specifically

1. **A green baseline.** 2 real failures + 8 typecheck errors. Nothing else matters until this is fixed.
2. **The gateway suite actually running.** 16 cases covering invitation-only registration, lockout, suspension-kills-sessions, single-use reset links, and audit persistence are written and *dark*.
3. **API integration tests.** No test issues an HTTP request to a route handler. CSRF rejection, cookie flags, `withAdmin`, and the typed error→status mapping are all untested end-to-end.
4. **Cross-student authorization tests at the boundary.** The engines test `studentId` mismatch in memory (good), but the scenario the brief names — *Student B does `GET /roadmaps/123` and must get 403/404* — is untested, because the routes do not exist. This test must be written **with** the first real route, not after.
5. **The core learning loop E2E.** Nothing covers: New Student → Assessment → Diagnosis → Goal → Lock → Roadmap → Mission → Test → Failure → Recovery → Retest → Mastery. Today that chain is *also* broken in the product (goal/roadmap/execution are per-student and real; mastery/recovery/tests are static mocks that never react), so the E2E would fail for product reasons, not just test reasons. **That is the correct order: build the loop, then the test that proves it.**
6. **Transaction tests.** No test asserts atomicity of a multi-entity operation (there is only one transaction, and it is in the dark gateway suite).
7. **`QuestionValidator` tests** — cannot exist yet; the validator does not exist.
8. **Coverage measurement.** No `coverage` script, no thresholds (`/coverage` is gitignored but never produced).

---

## 8. Migration Plan

Sequencing principle: **green → seams → schema → routes → engines → AI → security → E2E → hardening.** Each phase is independently shippable and independently revertable. No phase rewrites an engine.

---

### Phase 0 — Audit ✅ *(this document)*

- **Goal:** establish ground truth without touching code.
- **Files:** `docs/ARCHITECTURE_AUDIT.md` (new, additive).
- **Dependencies:** none.
- **Risk:** none.
- **Tests:** baseline recorded — lint pass, test 400/402, typecheck 8 errors, build/generate environmentally blocked.
- **Exit criteria:** report reviewed; **explicit approval received before Phase 1.**

---

### Phase 1 — Restore green + repository boundaries

- **Goal:** (a) get `typecheck` and `test` passing; (b) insert storage/repository seams *under* the existing engines without altering a line of domain logic.
- **Files:**
  - Green: `src/features/assessment/components/assessment-intro.test.tsx` (rewrite expectations against the current discovery screen — **fix the test, do not weaken it**), `prisma/schema.prisma` header comment, `src/test/test-env.ts`, `prisma/migrations/*` (regenerate for Postgres — see P1-1).
  - Seams: new `src/services/ports/{goal,roadmap,assessment,execution}-store.ts` (interfaces); `src/services/infrastructure/local-storage-*.ts` (today's behaviour, extracted verbatim); engines change only their `loadX/saveX` bodies.
  - Optional but recommended: `.github/workflows/ci.yml` running `typecheck` + `lint` + `test`.
- **Dependencies:** working `prisma generate` (network) — or defer the schema/migration fix to Phase 2 and unblock tests with a generated-client check in CI.
- **Risk:** **Low.** Engines keep their logic; only storage moves. The extraction is mechanical and the 113 engine tests are the safety net.
- **Tests:** existing 402 must pass, plus new store-interface unit tests; `assessment-intro` rewritten to assert the *real* current copy.
- **Exit criteria:** `npm run typecheck` exit 0 · `npm run test` all green including `gateway.test.ts` · `npm run lint` exit 0 · no engine imports `window.*` · CI green on the branch.

---

### Phase 2 — Database

- **Goal:** the Tier-1 schema exists, migrates cleanly on Postgres, and is reachable from a repository layer.
- **Files:** `prisma/schema.prisma`, new `prisma/migrations/*`, new `src/lib/server/repositories/prisma-*.ts`, `prisma/seed.mjs`.
- **Dependencies:** Phase 1 (ports defined).
- **Risk:** **Medium.** Schema shape is hard to change later; migrations must be reversible. Mitigation: additive-only migrations, no data yet to lose.
- **Tests:** repository contract tests run against a real Postgres, **once per port** so `Prisma*` and `LocalStorage*` implementations prove the same behaviour; migration up/down; constraint tests (duplicate idempotency key rejected, duplicate `(roadmapId, learningUnitId)` rejected, cross-student fetch returns nothing).
- **Exit criteria:** `prisma migrate deploy` succeeds on Postgres · unique constraints and FKs verified by test · every Tier-1 port has both implementations passing an identical contract suite · transaction tests green for the six operations named in §5.

---

### Phase 3 — Real APIs

- **Goal:** implement the ~25 missing endpoints; move engines server-side; flip domains off mocks **one at a time**.
- **Files:** new `src/app/api/{assessment,goals,roadmaps,executions}/**/route.ts`; a shared `withStudent(req, fn)` wrapper mirroring the existing `withAdmin`; per-domain flag replacing the single global `USE_MOCK`.
- **Dependencies:** Phase 2.
- **Risk:** **High — this is the riskiest phase.** Mitigations: (1) per-domain flags, never one global switch; (2) each endpoint lands with its authorization test before it is enabled; (3) the existing `toGoalError`/`toRoadmapError`/`toExecutionError` funnels already map domain errors to codes — reuse them server-side so client error handling does not change.
- **Tests:** API integration tests per endpoint; **cross-student ownership test on every single resource** (B requesting A's goal/roadmap/execution/session ⇒ 404); CSRF; cookie flags; payload-size limits.
- **Exit criteria:** goals, roadmaps, executions, and assessments all served by real routes with real persistence · `studentId` on every `AssessmentSession` (P0-4 closed) · ownership tests green · `localStorage` no longer in any domain path.

---

### Phase 4 — Learning engines

- **Goal:** close the loop's honest gaps: server-graded tests, evidence-based mastery, real recall scheduling, guarded recovery.
- **Files:** new `src/lib/server/domain/{mastery,recall,recovery,test-grading}/…`; `learning.service.ts`, `intelligence.service.ts` (these have **no** HTTP branch yet — contracts must be designed, not ported); `test-runner.tsx` stops computing correctness.
- **Dependencies:** Phase 3.
- **Risk:** **Medium-high — touches product semantics.** Hard rule from the brief, applied: **preserve every existing heuristic and label it a heuristic.** The recall multipliers (2.2 / 1.4 / 0.6), the test recommendation bands (≥80 / ≥65), the roadmap `ALLOCATION_POLICY`, and the goal hours constants (`BASE_HOURS=20`, `HOURS_PER_LEVEL_STEP=60`) stay exactly as they are, renamed/documented as heuristics. **No invented psychometrics.** Where a real model would be needed (confidence, decay, recency), define the *shape* and mark the parameters as unvalidated.
- **Tests:** mastery from evidence fixtures (including "all units completed but module test failed ⇒ not mastered"); server-side grading parity; recovery transition guard; recall interval progression.
- **Exit criteria:** correctness computed only on the server (P0-1 closed) · mastery derived from stored `MasteryEvidence`, never from completion alone · recovery has a transition table like its three siblings · `/app/mastery`, `/app/recovery`, `/app/behavior` render derived data.

---

### Phase 5 — AI infrastructure

- **Goal:** `AIProvider` + `QuestionGenerator` + `QuestionValidator` + mentor context builder, with guardrails.
- **Files:** new `src/lib/server/ai/{provider,gemini-provider,mock-provider,question-validator,mentor-context}.ts`; refactor `question-generator.ts` behind the interface; `/api/assessment/generate` gains auth + Zod validation; new mentor route.
- **Dependencies:** Phase 3 (auth on the route), Phase 4 (evidence for mentor context).
- **Risk:** **Medium.** Contained by keeping the existing deterministic fallback as `MockAIProvider` — the product keeps working with no key.
- **Tests:** validator rejects malformed/adversarial model output; provider timeout + retry + fallback; **guardrail test asserting the mentor response schema cannot express a state change**; prompt-injection fixtures; token-budget cap.
- **Exit criteria:** no direct vendor `fetch` outside a provider · all model output Zod-validated before entering the domain · scoring never in any client response (**P0-2 closed**) · generate route authenticated, rate-limited, schema-validated (**P1-2 closed**) · mentor runs on minimal context.

---

### Phase 6 — Security

- **Goal:** prove, by test, the properties the code already largely claims.
- **Files:** `lib/server/auth/rate-limit.ts` (swap to a shared store behind the same two functions), `lib/server/auth/request.ts` (cookie hardening), route wrappers, new `src/lib/server/authz.ts`.
- **Dependencies:** Phase 3.
- **Risk:** **Low-medium.** Additive.
- **Tests:** RBAC matrix (student/guardian/admin × each resource); ownership on all 10 resource families named in the brief; session expiry + revocation; rate limiting across a simulated multi-instance deployment; cookie `httpOnly`/`secure`/`sameSite`; prompt-injection and unsafe-URL fixtures; payload limits.
- **Exit criteria:** the full authorization matrix green · no route without a guard · rate limiting effective beyond one instance · audit trail covers every state-changing operation.

---

### Phase 7 — E2E

- **Goal:** one test that *is* the product thesis.
- **Files:** a runner (Playwright recommended — not yet a dependency, so this is the one justified addition), `e2e/learning-loop.spec.ts`.
- **Dependencies:** Phases 3–5.
- **Risk:** **Low** technically, but it will surface real product gaps — that is its purpose.
- **Tests:** New Student → Assessment → Diagnosis → Goal → Goal Lock → Roadmap → Mission → Test → Failure → Recovery → Retest → Mastery, asserted on real persisted state across a page reload.
- **Exit criteria:** the loop passes from a clean database · survives reload (proving persistence) · a second student cannot see the first student's data at any step.

---

### Phase 8 — Production hardening

- **Goal:** operability.
- **Files:** structured logging, error reporting, health/readiness, font self-hosting, dead-code removal (`lib/supabase/*` — P2-2), coverage thresholds, load and backup verification.
- **Dependencies:** all prior.
- **Risk:** **Low.**
- **Tests:** chaos/failure-injection on provider and DB outages; restore drill; coverage thresholds enforced in CI.
- **Exit criteria:** the Definition of Done in §18 of the brief is satisfied and each line is backed by a named passing check.

---

## 9. Explicit non-goals (honoured throughout this audit and the plan)

No framework change · no rewrite · no UI change without necessity · no business-rule change without evidence · no deleted or skipped tests · no disabled typecheck/lint · no hidden errors · no speculative abstractions · not every interface becomes a class or a table · the LLM never owns a domain decision · **no Redis, queues, or microservices** — the only infrastructure addition proposed anywhere in this plan is a shared rate-limit store in Phase 6, and it sits behind the two functions that already exist.

**The through-line:** this codebase has unusually good domain logic trapped behind unusually thin infrastructure. The work is to build the floor, not to redesign the house.
