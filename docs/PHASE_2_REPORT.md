# Phase 2 — PostgreSQL + Prisma + Repositories

Branch `arena/01a0e78e-ai-study-time` · commits `d8f177d..HEAD`
Companion documents: `docs/ARCHITECTURE_AUDIT.md` (Phase 0), `docs/PHASE_1_REPORT.md`,
`docs/ENDPOINT_INVENTORY.md`.

---

## 1. Summary

The persistence layer behind the Phase 1 ports is now real. Four Prisma
adapters sit behind `AssessmentSessionStore`, `GoalStore`, `RoadmapStore` and
`ExecutionStore`; eight learning-domain tables were added; and the production
server path — all nine assessment route handlers — runs on PostgreSQL with no
mock fallback.

Three things drove the design:

**The ports became asynchronous before the database arrived.** Every engine
method now returns a `Promise`. That conversion touched 16 test files and 356
call sites, and it is the reason no engine line changed when the adapters
landed: the domain already spoke in futures, so swapping an in-memory map for
a query was invisible to it.

**Constraints replaced checks.** Phase 1 enforced idempotency with
`if (!existing) create`, which is correct when requests arrive in turn and
wrong when they arrive together. Every such check is now backed by a unique
constraint, and a violation surfaces as a typed `PersistenceConflictError` →
HTTP 409 rather than as a silently duplicated row or a leaked `P2002`.

**The answer key became structural.** `AssessmentQuestion` stores the public
question and the scoring key in two separate columns. "Never serve
`correctOptionId`" is no longer a convention a serializer has to remember; it
is a property of the row shape, and an integration test asserts it across the
whole HTTP path.

The domain still contains no reference to React, Next.js, Prisma, PostgreSQL,
`fetch`, `localStorage`, cookies or HTTP. Verified rather than asserted —
`grep -rln "@prisma" src` returns exactly eight files, and not one of them is
domain code:

```
src/lib/server/db.ts                              the single PrismaClient site (pre-existing)
src/lib/server/auth/gateway.ts                    auth core (pre-existing)
src/services/infrastructure/prisma/context.ts     transaction context + error translation
src/services/infrastructure/prisma/session-store.ts
src/services/infrastructure/prisma/goal-store.ts
src/services/infrastructure/prisma/roadmap-store.ts
src/services/infrastructure/prisma/execution-store.ts
src/services/infrastructure/prisma/index.ts       createPrismaStores(prisma)
```

Zero matches under `src/services/{assessment,goals,roadmap,execution}`, and
zero under `src/types` and `src/schemas`.

---

## 2. Database Decision

**Target: PostgreSQL, reached through Prisma. Unchanged, and re-confirmed
against the code rather than the filenames.**

What the audit found:

| Question | Finding |
|---|---|
| Provider in `schema.prisma` | `postgresql` |
| Provider in `migration_lock.toml` | `postgresql` |
| Supabase SDK anywhere | **absent** — `src/lib/supabase/` was deleted in Phase 1 |
| Generated client present | yes, after `prisma generate` |
| `DATABASE_URL` consumer | `src/lib/server/db.ts`, the single construction site |

Supabase, where it is used at all, is used as *hosted PostgreSQL*. The
consequence is architectural and worth stating plainly: the application talks
to PostgreSQL through Prisma, and never imports a Supabase client. Adding the
Supabase SDK alongside Prisma would give two persistence paths, two
transaction scopes and two ideas of what a row is.

**Ratification required (§32).** The generated client runs with
`engineType = "client"` plus `@prisma/adapter-pg` and `pg` as the driver. This
was not a stylistic choice: Prisma's native query engines could not be fetched
in this environment, and the client engine is the supported path that does not
need them. It is a real infrastructure decision — a driver adapter between
Prisma and PostgreSQL rather than Prisma's own connection handling — and it
should be ratified rather than inherited.

One operational consequence follows from it and is not yet handled:
`@prisma/adapter-pg` opens its own `pg` pool, so connection-pooler settings
(`pgbouncer` transaction mode in particular) have to be validated against a
real deployment target before this runs anywhere shared.

---

## 3. Models Added

Eight models. Each is a **persistence entity**: it has an identity, an owner,
a lifecycle and queries of its own. Everything else the domain names was
classified and deliberately left out — see the second table.

| Model | Reason | Owner | Important constraints |
|---|---|---|---|
| `AssessmentSession` | The diagnosis attempt is a durable record with a status lifecycle and a completed result other features read. | Student (`studentId`) | `@@index([studentId, status])` serves *get active session*; `@@index([studentId, completedAt(sort: Desc)])` serves *latest diagnosis*. `topicState Json` holds the per-topic tally. |
| `AssessmentQuestion` | One row per bank item in a session. Exists so the answer key can live apart from the question. | Student, via session (cascade) | `@@unique([sessionId, questionId])` — domain ids repeat across sessions. **`question Json` (public) and `scoring Json` (answer key) are separate columns.** |
| `AssessmentAnswer` | A graded response is the evidence behind a diagnosis; it cannot be recomputed after the fact. | Student, via session (cascade) | **`@@unique([sessionId, submissionId])`** — database-level idempotency. FK to `AssessmentQuestion`. `points Float` is server-derived; **there is no client-writable correctness column anywhere in the schema.** |
| `Goal` | The central aggregate: locked, revised, referenced by roadmaps. | Student (`studentId`) | `@@unique([studentId, createIdempotencyKey])`, `@@unique([studentId, lockIdempotencyKey])` (NULLs are distinct in PostgreSQL, so keyless goals never collide), `@@index([studentId, status])`, `version Int` as the optimistic-concurrency token, self-relation `revisesGoalId`. |
| `Roadmap` | A generated plan with versions kept for history. | Student (`studentId`) | **`generationKey String @unique`**, **`@@unique([studentId, version])`**, `@@index([studentId, status])`, FK → `Goal`. |
| `RoadmapMilestone` | Ordered step grouping units; carries the goal-alignment rationale. | Student, via roadmap (cascade) | Surrogate `id`; domain `milestoneId` kept separately because `ms_<capabilityId>` **repeats across roadmap versions**. `@@unique([roadmapId, milestoneId])`, `@@unique([roadmapId, order])`. |
| `LearningUnit` | The atomic piece of work a student actually does. | Student, via roadmap (cascade) | Surrogate `id`; domain `unitId` (`unit_<capabilityId>_<slotType>`) also repeats across versions. `@@unique([roadmapId, unitId])`, `@@unique([milestoneId, order])`. |
| `LearningUnitExecution` | One attempt per unit; retries mutate it. | Student (`studentId`) | **`@@unique([roadmapId, learningUnitId])`** encodes "one attempt per unit per roadmap". Composite FK `([roadmapId, learningUnitId]) → LearningUnit([roadmapId, unitId])` makes a cross-roadmap reference impossible. `evidence Json?`, `result Json?`. |

All eight cascade from `User`. There is no orphaned learning data by design:
deleting an account deletes its history, and an integration test asserts
exactly that across all five tables.

**Value objects stored as `Json` on their aggregate root** — no table, because
they have no identity, no independent lifecycle and are never queried or
joined apart from their owner: goal `motivation` / `targetDomain` / `timeframe`
/ `weeklyCommitment` / `diagnosisContext` / `validation`; roadmap
`estimatedDuration` / `timeFeasibility` / `generationContext`; milestone
`checkpoint`; answer `response`; question `question` / `scoring`; execution
`evidence` / `result`.

### Classified and deliberately NOT modelled

| Type | Classification | Why no table |
|---|---|---|
| `AssessmentResult`, `Diagnosis` | **Derived state** | Deterministic from the `AssessmentAnswer` rows; `getResults()` recomputes it. Persisting it would create a second source of truth that can disagree with the answers. |
| `GoalValidationResult` | Derived state | Lives on the goal as JSON — it is a property of the goal, not an entity. |
| `GoalEvent` | Domain event | The domain has no event log. Inventing one is an architecture change, not a migration. |
| `PublicQuestion` / `InternalQuestion` | DTO | Serialisation shapes, not stored objects. |
| `RoadmapExecutionView`, `DerivedUnitStatus` | View model | Projections computed by `execution-projection.ts`. |
| `Mission*`, `Test*`, `RecallCard*`, `MasteryEvidence`, `RecoveryPlan*`, `Behavior*`, `MentorConversation*`, `Achievement`, `Certificate` | Not yet entities | **No engine, no port, no HTTP endpoint.** Per §22/§23 these are Phase 4; modelling them now would be schema for behaviour that does not exist. |
| `StudentProfile` | Not an entity | The domain has `User.role`; there is no separate profile concept. |

---

## 4. Repositories Added

| Port | Prisma implementation | Mock adapter | Tests |
|---|---|---|---|
| `AssessmentSessionStore` | `PrismaAssessmentSessionStore` | `createStores("memory" \| "localStorage")` | 10 contract × 2 adapters; 11 reality |
| `GoalStore` | `PrismaGoalStore` | same | same |
| `RoadmapStore` | `PrismaRoadmapStore` | same | same |
| `ExecutionStore` | `PrismaExecutionStore` | same | same |

Layout:

```
src/services/infrastructure/prisma/
  context.ts         transaction context (AsyncLocalStorage), error translation
  session-store.ts   PrismaAssessmentSessionStore
  goal-store.ts      PrismaGoalStore
  roadmap-store.ts   PrismaRoadmapStore
  execution-store.ts PrismaExecutionStore
  index.ts           createPrismaStores(prisma)
```

Composition roots — one copy of the wiring, two sets of storage:

```
src/services/engines-core.ts    composeEngines(stores, { diagnosisViaHttp })
src/services/engines.ts         browser mock runtime + tests → memory / localStorage
src/services/engines.server.ts  API routes + SSR              → PostgreSQL
```

`engines.ts` **must** stay importable from client components, so it never
touches `PrismaClient` — which holds the connection string. That separation is
the reason there are two roots rather than one with a runtime branch.

**No Prisma type crosses the boundary.** Every adapter method returns the
domain shape: `Promise<LearningGoal | undefined>`, never
`Promise<PrismaGoal>`. Row→domain translation, including every
`Date` ↔ ISO-8601 conversion, happens inside the adapter file and nowhere
else.

Two adapter decisions worth recording:

- **Milestones and learning units are upserted, never deleted and recreated.**
  A roadmap is re-saved on every status change, and `LearningUnitExecution`
  cascades from its unit. Rewriting the tree would have silently deleted the
  student's execution history with it.
- **Timestamps are written from the domain, not from the database.** The
  engine sets `createdAt` / `updatedAt` / `lockedAt` as part of the transition
  it performs. Letting `@updatedAt` win would make the stored goal disagree
  with the one the engine just returned; a contract test pins this.

**A latent defect fixed along the way.** `assessmentResultSource` decided
between in-process and HTTP by sniffing `process.env.VITEST` *inside the
engine*. On the server composition root that meant production would have
attempted a relative `fetch` to itself. The decision now belongs to the
composition root, which makes the wrong version unrepresentable.

---

## 5. Migrations

| Name | Purpose | Risk |
|---|---|---|
| `20260912144957_auth_gateway` | Pre-existing: `User`, `Session`, `Invitation`, `PasswordResetToken`, `AuditEvent`, `OutboxMessage`. Untouched. | None — unchanged. |
| `20260928120000_learning_domain` | Adds the eight learning-domain tables, their foreign keys, unique constraints and indexes. | **Additive only. CREATE-only SQL — no `DROP`, no `ALTER`, no data touched.** |

**No destructive migration was required, so no §16 stop was triggered.** Both
migrations were verified by dropping `mureeh_test`, recreating it empty, and
applying them from scratch:

```
applied 20260912144957_auth_gateway
applied 20260928120000_learning_domain
2 migration(s) applied
```

Resulting tables: `AssessmentAnswer, AssessmentQuestion, AssessmentSession,
AuditEvent, Goal, Invitation, LearningUnit, LearningUnitExecution,
OutboxMessage, PasswordResetToken, Roadmap, RoadmapMilestone, Session, User,
_prisma_migrations`.

**Migration tooling caveat, recorded because it will bite the next person.**
`prisma migrate diff` exits 0 and emits **zero bytes** in this environment;
`migrate status` and `migrate deploy` fail with an empty `Schema engine
error`. The SQL is therefore hand-authored and then *proven* by applying it to
a clean database through `scripts/apply-migrations.mjs`, which keeps the same
`_prisma_migrations` bookkeeping `migrate deploy` would. `prisma validate`
works and reports the schema valid. In an environment with working schema
engines, these hand-written files should be regenerated and diffed against
the schema before being trusted as canonical.

---

## 6. Ownership Matrix

| Resource | Owner | Enforcement |
|---|---|---|
| `AssessmentSession` | The student named in the session cookie | `requireStudentApi()` resolves the id from the cookie; the engine's `ownSession` compares `session.studentId` and answers **404** for a foreign id — never 403, so existence is not disclosed. |
| `AssessmentAnswer` | Owner of its session | Written only through `submitAnswer`, which resolves the session first. `submissionId` is unique per session, so a crafted body cannot append to someone else's session. |
| `Goal` | The student in the cookie | `ownGoal` → **403 `forbidden`**. |
| `Roadmap` | The student in the cookie | `ownRoadmap` → **404**. |
| `LearningUnitExecution` | The student in the cookie | Resolved through the roadmap, which is ownership-checked first. |
| Every table | `User` | `onDelete: Cascade` on all eight. No orphaned learning data. |

**`client.studentId` is never trusted.** No handler reads a student id from a
body, a query string or a header. `POST /api/assessment/sessions` with a body
naming another student creates the session for the *cookie's* student, and a
test asserts the crafted id is ignored entirely.

The 403-vs-404 inconsistency between goals and the other two aggregates is
real, pre-existing, pinned by four assertions, and deferred to Phase 3 where
authorization becomes the subject. Changing it now would be an unrequested
API behaviour change.

---

## 7. Transaction Matrix

| Operation | Transaction required? | Reason |
|---|---|---|
| Create assessment session | **Yes** (inside the adapter) | Writes the session row, its question rows and any response rows. Answers carry an FK to their question, so a crash between the two would leave responses pointing at nothing. |
| Submit answer | **Yes** (inside the adapter) | Same aggregate: session state and its response rows must agree on progress. |
| Complete / submit assessment | **Yes** (inside the adapter) | Status transition and the final responses commit together. |
| Pause / resume session | **Yes** (inside the adapter) | Single aggregate, but the same write path — not a separate case. |
| Create goal | **No** | One row. A transaction around a single write is theatre, not safety. |
| Lock goal | **No** | One row, one status change. |
| **Revise goal** | **Yes** (port-level `transaction()`) | Two aggregates: the old goal becomes `revised` *and* a successor is inserted. A failure between them leaves the student with no editable goal at all. |
| **Create roadmap / regenerate** | **Yes** (adapter, plus port-level `transaction()`) | Internally: roadmap + milestones + units. Across aggregates: the previous plan is superseded *and* the new one published. Written separately, a failure leaves either two live plans or none — and `getActiveRoadmap` picks "newest live", so both are visible bugs. |
| Complete mission / submit test / record mastery / trigger recovery | **n/a** | No engine, no port, no table. Phase 4. |

The supersede loop in `generateRoadmap` was **restructured** to make this
possible: it used to write each superseded roadmap immediately, before the new
plan was even built. It now collects them and writes everything in one
transaction, after `validateRoadmapStructure()` has passed.

`transaction()` was added to `GoalStore` and `RoadmapStore` **only** — the two
stores that own a multi-aggregate write. The in-memory and localStorage
adapters run the work straight through, because they have no partial write to
protect.

---

## 8. Test Results

| Check | Command | Result |
|---|---|---|
| Lint | `npx eslint src` | **0 problems** (exit 0) |
| Typecheck | `npx tsc --noEmit` | **0 errors**, production and test files |
| Unit + integration | `npx vitest run` | **483 passed / 0 failed, 35 files** |
| Repository integration | `store-contract.test.ts` + `prisma-store-reality.test.ts` | **31 passed** (20 contract × 2 adapters + 11 PostgreSQL-only) |
| API integration | `assessment-routes.test.ts` | **16 passed**, through the real Prisma-backed handlers |
| Auth integration (real PostgreSQL) | `gateway.test.ts` | **16 passed** |
| Schema validity | `npx prisma validate` | **valid** |
| Migrations from scratch | drop + recreate + apply | **2 applied, 15 tables** |
| Build | `npx next build` | **Succeeds** — with one environment substitution, below |

Suite composition of the 483: engine unit 201 · component 107 · auth gateway
16 · store contract/reality 31 · API integration 16 · other service and
projection suites 112.

**The same contract runs against both adapters.** `store-contract.test.ts` is
one `describe.each` over the in-memory collections and real PostgreSQL. It
asserts round-trip fidelity by deep equality against the object the engine
produced — so a JSON column that drops a key, or a `Date` that comes back in a
different representation, fails there rather than in production. Ownership
scoping, update-in-place, `undefined`-not-null for missing ids, timestamp
preservation and execution scoping are all shared assertions.

**The 11 PostgreSQL-only assertions cover what a mock cannot:** duplicate
idempotency key rejected; two students may reuse one key; duplicate
`generationKey` rejected; a replayed submission counted once under concurrent
writers; cross-roadmap unit reference rejected; one execution per unit;
**rollback leaves zero rows**; multi-aggregate commit; cascade on user delete;
answer key absent from the public column and present in `scoring`; two
concurrent writers → exactly one row and one `PersistenceConflictError`.

### Build — verified with one substitution

`next build` compiles the full application: **27 API routes** and all pages.
It does not complete against the real network in this sandbox, because
`src/app/layout.tsx` loads `IBM Plex Sans Arabic` and `Noto Kufi Arabic` via
`next/font/google`, and `fonts.googleapis.com` is unreachable
(`ECONNRESET`). `layout.tsx` was **not** modified to work around it.

The build was therefore completed with Next.js's own offline mechanism,
`NEXT_FONT_GOOGLE_MOCKED_RESPONSES`, pointed at a two-entry stub outside the
repository. That substitution affects only the font CSS fetch; it does not
touch application code, and it is not a claim that the real font fetch works.

### Tests this phase caught, worth naming

- **Eight route handlers were passing an un-awaited `Promise` into
  `NextResponse.json()`**, which serialises to `{}` behind a `201`. `tsc`
  cannot catch it — the signature accepts `any`. The HTTP boundary test did.
- **`generationKey` was missing from the roadmap write.** The typechecker
  caught it. Without it the unique constraint that replaces the racy
  in-memory idempotency scan would never have been populated — the entire §14
  guarantee, silently absent.
- **`assessment-routes.test.ts` carried `vi.mock("@/lib/server/db", () => ({
  prisma: {} }))`** — correct while the engine was in-memory, and afterwards a
  stub that made every model delegate `undefined`.
- **`.pgdata/` was committed.** 1771 files of a live PostgreSQL cluster —
  rows, WAL segments, server key material — went into two commits because the
  directory was neither ignored nor untracked. Now ignored and removed from
  the index. The objects remain in history and should be treated as
  non-sensitive local fixtures, but the history was not rewritten.

---

## 9. Remaining Risks

**P0 — none open in Phase 2's scope.**

The two P0 defects carried from Phase 0/1 are resolved: AI answer keys no
longer reach the browser, and every session is bound to the authenticated
student. Both have regression tests, and the answer-key one is now enforced
structurally by the schema as well.

One P0-class defect remains, **outside Phase 2 and untouched by it**:

- **Module tests are still graded by the browser.**
  `src/features/quizzes/components/test-runner.tsx:71` computes correctness
  client-side, and `TestResultAnswer.correct: boolean` (`src/types/domain.ts:187`)
  carries the verdict in the client's own type. This is the same class of
  defect as the assessment one, in a feature that has no engine, no port and
  no endpoint. It belongs to Phase 4, and it should not be forgotten there.

**P1**

- **No connection-pool validation.** `@prisma/adapter-pg` owns its own `pg`
  pool. Behaviour against a transaction-mode pooler is untested and could
  surface as prepared-statement errors under load.
- **`ExecutionStore.list()` is unbounded.** The engine reads across all
  roadmaps when deciding whether a unit was attempted before. Correct today,
  and a linear scan that grows with every attempt ever recorded. Needs a
  scoped query before any real volume.
- **Rate limiting is in-memory and single-instance** (`rate-limit.ts`). Two
  replicas give two independent budgets. Pre-existing; noted because Phase 2
  made multi-instance deployment more plausible.

**P2**

- **Migrations are hand-authored** because `prisma migrate diff` is broken
  here. They are proven by clean-database application, but they have not been
  through Prisma's own generator.
- **`next/font/google` needs the network at build time.** Any CI runner
  without egress will fail the build for a reason unrelated to the code.
- **403 vs 404 inconsistency** between goal and roadmap/assessment ownership
  failures.
- **`@prisma/client` generation depends on a local engine mirror**
  (`PRISMA_ENGINES_MIRROR`) in this environment. A normal environment will not
  need it; this one will not generate without it.

**P3**

- Structured logging is present only on the failure path. Success-path
  observability (request id propagation, domain events, durations) is Phase 8.
- `AssessmentSession.status` is still enforced by inline `if`s rather than a
  state machine, unlike goal, roadmap and execution which have tested ones.

---

## 10. Deferred Work

**Phase 3 — Real APIs + Authorization**

- Goal (7), Roadmap (5) and Execution (5) endpoints. Their Prisma stores are
  implemented and contract-tested; nothing reaches them over HTTP yet.
- Flip `USE_MOCK` in `src/lib/api/client.ts`. Until then the *browser* still
  runs the mock runtime against localStorage. The server does not.
- Resolve the 403/404 inconsistency into one ownership-failure contract.
- Scoped replacement for `ExecutionStore.list()`.

**Phase 4 — Learning Engines**

- Mastery, recall, missions, tests, recovery: engines, ports, then tables.
  None are modelled now, deliberately.
- Client-side grading in `test-runner.tsx` — the remaining P0-class defect.

**Phase 5 — AI Infrastructure**

- A provider interface around `callGemini`: schema validation, timeout, retry,
  token budget, structured logging. Today it is a bare `JSON.parse` with no
  timeout and no retry.
- Prompt-injection resistance and context minimisation for the generator.

**Phase 8 — CI + Observability**

- Pipeline: install → lint → typecheck → unit → integration → build.
- Success-path structured logging.

---

## 11. Final Status

Everything inside Phase 2's own scope is implemented and verified: a
consistent PostgreSQL provider, a valid schema, coherent additive migration
history that applies from scratch, four Prisma repositories behind the Phase 1
ports, mocks retained and proven equivalent by a shared contract, production
running on real repositories with no mock fallback, a domain that is
infrastructure-free, 483 passing tests including repository and API
integration, ownership enforced server-side, no client-controlled ownership,
no answer-key leak, and constraints/transactions/idempotency backed by the
database rather than by application-level checks.

One acceptance item cannot be closed here. The production build does not
complete against the real network, because `next/font/google` cannot reach
`fonts.googleapis.com` from this sandbox. It compiles fully — all 27 API
routes and every page — when that single fetch is satisfied through Next.js's
own offline mechanism. That is an environment blocker, not a code defect, and
§30 is explicit that a remaining environment blocker rules out a `PASS` claim.

**PHASE 2 — PARTIAL**

| Item | Status |
|---|---|
| Schema, models, migrations, indexes, constraints | **VERIFIED** |
| Prisma repositories + mock adapters + shared contract | **VERIFIED** |
| Production server path on PostgreSQL, no mock fallback | **VERIFIED** |
| Ownership, idempotency, concurrency, transactions | **VERIFIED** |
| Answer-key boundary across HTTP and database | **VERIFIED** |
| Lint, typecheck, 483 tests | **VERIFIED** |
| Production build against the real network | **BLOCKED** — no egress to `fonts.googleapis.com`; build completes with the font fetch mocked |
| Browser client off the mock transport | **DEFERRED** — Phase 3, by the fixed phase order |
