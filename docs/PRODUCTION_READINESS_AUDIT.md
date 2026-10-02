# Production Readiness Audit — Phase 0

**Branch:** `arena/01a0fd58-ai-study-time` · **Baseline commit:** `42e4354`  
**Date:** 2026-10-02 · **Mode:** READ → MAP → AUDIT (no code changed yet)

---

## 1. Architecture Map (as-built)

```
Browser (Next.js 15 App Router, React 19, i18n RTL, Tailwind)
  │
  ├─ Features (assessment, goals, roadmap, execution, mentor, recall, tests, mastery, behavior, recovery...)
  │    └─ Hooks (TanStack Query)
  │
  ├─ Services — typed domain contracts
  │    ├─ assessment.service.ts  ─┐
  │    ├─ goal-discovery.service ─┤─► httpRequest / mockRequest seam (lib/api/client.ts)
  │    ├─ roadmap.service ────────┤   REAL_TRANSPORT = !process.env.VITEST
  │    ├─ execution.service ──────┘   DEMO flag degrades to 501 outside test/demo
  │    ├─ journey, learning, intelligence, engagement (still mockOnly)
  │    └─ mock-db.ts (typed seed data, no persistence)
  │
  ├─ API Routes (Next Route Handlers, Node runtime)
  │    ├─ /api/auth/* (8) — gateway (Prisma + scrypt + sessions + tokens + outbox)
  │    ├─ /api/assessment/* (9) — engine → store
  │    ├─ /api/goals/* (7) — application → engine
  │    ├─ /api/roadmaps/* (5) — application → engine + curriculum
  │    ├─ /api/executions/* (5) — application → engine + projections
  │    ├─ /api/admin/* (10) — gateway
  │    ├─ /api/health (1) — liveness
  │    └─ middleware.ts (edge presence gate, no DB)
  │
  ├─ Application Layer (src/services/application/*)
  │    ├─ assessment-application.ts
  │    ├─ goal-application.ts
  │    ├─ roadmap-application.ts
  │    └─ execution-application.ts
  │         └─ withStudent(auth) + Zod + per-route rate limiting
  │
  ├─ Domain Engines (framework-free, deterministic)
  │    ├─ assessment (adaptive selection, scoring, diagnosis)
  │    ├─ goals (validation, state machine, hours heuristic)
  │    ├─ roadmap (curriculum, graph topological sort, time budgeting, quality gate)
  │    └─ execution (dependency gating, evaluator, state machine, projection)
  │
  ├─ Ports (src/services/ports/*)
  │    ├─ stores.ts (AssessmentSessionStore, GoalStore, RoadmapStore, ExecutionStore)
  │    └─ lookups.ts (GoalLookup, RoadmapLookup, AssessmentResultSource)
  │
  ├─ Repositories (src/services/infrastructure/*)
  │    ├─ collection-store.ts (memory / localStorage)
  │    └─ prisma/* (session-store, goal-store, roadmap-store, execution-store)
  │
  └─ Persistence
       ├─ Prisma schema (provider postgresql, engineType client + @prisma/adapter-pg)
       ├─ 16 tables (User, Session, Invitation, PasswordResetToken, EmailVerificationToken,
       │           AuditEvent, OutboxMessage, AssessmentSession/Question/Answer, Goal,
       │           Roadmap/Milestone/LearningUnit, LearningUnitExecution)
       └─ PostgreSQL (embedded-postgres for local/test, any PG provider in prod)
```

**Invariant enforcement:**
- Duration: `src/lib/server/db.ts` is the ONLY `new PrismaClient()` site.
- Domain imports zero Prisma: `grep -r "@prisma" src/services/{assessment,goals,roadmap,execution}` → 0.
- API routes import zero Prisma delegates (verified in Phase 3).

---

## 2. Production Gap Matrix

Scale: REAL = durable + tested + owned, PARTIAL = real logic + mock infra, MOCK = demo data, MISSING = no impl, DEFERRED = intentionally not in current phase.

| Domain | Current | Production Required | Gap | Priority |
|---|---|---|---|---|
| **Auth** | REAL | REAL | In-memory rate limiter (single instance), SMTP not verified live | P0-close |
| **Assessment** | REAL (9 routes) | REAL | (none — answer-key structural separation done) | P0-done |
| **Goal** | REAL (7 routes) | REAL | (none — diagnosis attached server-side) | P0-done |
| **Roadmap** | REAL (5 routes) | REAL | (none — deterministic planner + quality gate) | P0-done |
| **Execution** | REAL (5 routes) | REAL | ExecutionStore.list() unbounded scan | P1 |
| **Concept Model** | MISSING | REAL (hierarchy, prerequisites, version) | No table, no catalog, LearningUnit has no conceptId | **P0** |
| **LearningEvent** | MISSING | REAL (append-only, indexed, owned) | No model — behavior/recovery/mentor cannot be evidence-driven | **P0** |
| **Evidence** | PARTIAL | REAL (owned, validated, immutable text/code/quiz/recall) | Only LearningUnitExecution.text; no generalized Evidence aggregate | **P0** |
| **ConceptState / LearnerModel** | MISSING | REAL (knowledge/retrieval/retention/transfer/fluency + confidence/hint/misconception) | No table — mastery is hardcoded | **P0** |
| **MasteryEngine** | MOCK | REAL (deterministic, server-authoritative, tested) | masteryService.list() → clone(db.mastery) | **P0** |
| **DiagnosisEngine** | PARTIAL | REAL (concept-level gaps, not just assessment topics) | synthesizeResult is assessment-only; no concept diagnosis | **P0** |
| **AdaptiveEngine** | MISSING | REAL (policy + WhyThisAction, no LLM authority) | No NextLearningAction, no mission generation | **P0** |
| **Learning Loop** | PARTIAL | REAL (Evidence → Evaluation → State → Diagnosis → Adaptive → Mission) | Evidence→State→Adaptive is not wired; UI shows static mastery | **P0** |
| **TestingEngine** | MOCK | REAL (server-authoritative, rubric per question) | Browser computes `correct`; no persisted Test domain | **P0** |
| **RecallEngine** | MOCK | REAL (evidence-driven scheduling, not confidence×2.2) | Self-rated `intervalDays * factor` | **P1** |
| **RecoveryEngine** | MOCK | REAL (trigger → strategy → mission → evidence → re-eval) | `advanceStep(any)` accepts anything | **P1** |
| **BehaviorEngine** | MOCK | REAL (observable events only) | Hardcoded percentages | **P1** |
| **AI Mentor** | MOCK | REAL (real learner context, validator, no hallucination) | 6× `if(q.includes)` | **P1** |
| **Guardian** | MOCK | REAL (explicit relation, minimal exposure) | `guardianService` → `clone(db.guardian)` | **P1** |
| **Billing** | MOCK | DEFERRED (entitlements, webhook truth) | `changeTier()` mutates memory | **P1-deferred** |
| **Notifications** | MOCK | P2 (bounded, persisted) | Static array | P2 |
| **Achievements** | MOCK | P2 | Static array | P2 |
| **Certificates** | MOCK | P2 | Static array | P2 |
| **Observability** | PARTIAL | REAL (requestId, structured logs, latency, DB/AI/email failures) | Only failure-path logs + liveness | **P0** |
| **Security** | PARTIAL | REAL (CSRF/CSP/HSTS/rate limiting/ownership/headers) | In-memory limiter, no CSP, CSP/HSTS headers missing | **P0** |
| **Privacy** | MISSING | REAL (deletion/export/retention) | Policy page shape only | **P0** |
| **Backup/Recovery** | MISSING | REAL (RPO/RTO doc, verified restore) | No doc | **P0** |
| **Deployment** | PARTIAL | REAL (migrate deploy, health, SMTP/AI env) | render.yaml ok, but no pooler validation, no smoke suite | **P0** |
| **Tests** | PARTIAL | REAL (unit+integration+HTTP+E2E critical path) | No E2E (Playwright) | **P0** |

---

## 3. What Is Production-Real vs Mock

**Production-real (do not touch without migration + test):**
- `User`, `Session`, `Invitation`, `AuditEvent`, `OutboxMessage`, `PasswordResetToken`, `EmailVerificationToken` — gateway fully REAL, hashed tokens, single-use, audit.
- `AssessmentSession`, `AssessmentQuestion`, `AssessmentAnswer` — structural answer-key separation, idempotency by unique constraint, ownership by `studentId`.
- `Goal`, `Roadmap`, `RoadmapMilestone`, `LearningUnit`, `LearningUnitExecution` — domain invariants as constraints, transactions for multi-aggregate writes, idempotency keys.
- 45 API handlers (auth/assessment/goals/roadmaps/executions/admin/health) — real application→engine→store→Prisma, ownership-checked, Zod-boundary.
- Curriculum (`curriculum.ts`) + graph + quality gate — deterministic, cycle-hostile.

**Mock / Demo-only (must not reach prod user without 501):**
- `src/services/mock-db.ts` + `src/mocks/data.ts` (mockStudent, mockGoal, mockRoadmap, mockMastery, mockBehavior, mockRecallCards, mockTests, …)
- `journey.service.ts` (studentService, goalService.requestChange, roadmapService, dailyPlanService, missionService)
- `learning.service.ts` (resourceService, recallService, testService, masteryService)
- `intelligence.service.ts` (behaviorService, recoveryService, mentorService with `composeContextualReply`)
- `engagement.service.ts` (achievements, certificates, notifications, plans, guardian)
- `src/services/infrastructure/collection-store.ts` `createLocalStorageCollection` — browser mock runtime only.

**Partial (real logic, synthetic persistence):**
- Mastery display (shape `MasteryEvidence` good, but data hardcoded).
- Recall/Tests (contracts good, but grading is client).

**Deferred (intentional):**
- Concepts beyond the 8 assessment topics — not modelled until engine exists.
- Billing entitlements — not in current product scope until Stripe decision.

---

## 4. Duplicate Abstractions / Leaks

- `src/types/domain.ts` `Roadmap` (phases/modules) vs `src/types/roadmap.ts` `Roadmap` (milestones/units/checkpoints) — legacy shape vs execution shape. Not deduplicated to avoid breaking existing `roadmapService`; the new engine shape is the source of truth, legacy is DEMO-only.
- `src/types/domain.ts` `Mission` (legacy, client `tick(state)`) vs `src/types/execution.ts` `LearningUnitExecution` (real). Same reason; legacy stays behind the DEMO gate.
- `src/lib/api/client.ts` `randomLatency()` uses `Math.random()` — test-only non-determinism, gated by `process.env.VITEST === 0`. Acceptable; no production consequence.
- No domain file imports `next/*`, `react`, `localStorage`, `fetch`, or `@prisma`. Verified.

---

## 5. Security Boundaries (audited)

| Boundary | Present | Gap |
|---|---|---|
| Authentication (scrypt, hashed token, invitation gate, lockout) | ✅ REAL | — |
| Email verification (hashed single-use token, expiry) | ✅ REAL | — |
| Authorization (withStudent / withAdmin, ownership per aggregate) | ✅ REAL | Goal uses 403, others 404 (documented contract difference) |
| CSRF (admin mutations check `x-requested-with` / origin) | ✅ Partial | Need to verify SPA fetch includes; add `csrf` token for cross-origin |
| Rate limiting (in-memory sliding window) | ⚠️ Partial | Single-instance only; IP via `x-forwarded-for` — deployment must sanitize |
| Headers (CSP, HSTS, CORS) | ❌ Missing | No CSP/HSTS in `next.config` or middleware |
| Validation (Zod at HTTP boundary) | ✅ REAL | — |
| IDOR | ✅ Tested | Ownership tests for every aggregate |
| Secrets exposure | ✅ Verified | `.next/static` scan found no `DATABASE_URL` / client bundle secrets |
| Mass assignment | ✅ | Schemas have no `studentId`/`status` writable fields |
| Answer-key leak | ✅ Fixed structurally | Two-column `question`/`scoring`; HTTP tests assert boundary |

---

## 6. Risk Register

| ID | Risk | Likelihood | Impact | Mitigant (phase) |
|---|---|---|---|---|
| R1 | Client-graded tests ship — browser declares mastery | High (already in `test-runner.tsx`) | P0 — false mastery | Phase 4: server-authoritative TestAttempt, no client `correct` |
| R2 | Mock mastery shown as measurement | Current | P0 — deceptive UI | Phase 2-3: real ConceptState + MasteryEngine, deferred state when not ready |
| R3 | Rate limiter multiplied by horizontal scale | Medium | P1 — brute-force budget | Phase 7: document single-instance requirement; shared store when scaling |
| R4 | `@prisma/adapter-pg` + pgbouncer transaction mode → prepared-statement errors | Medium | P1 | Phase 7: validate pooler; provide `pgbouncer` disable-prepared-statements guidance |
| R5 | `ExecutionStore.list()` full scan grows unbounded | Low now | P1 | Phase 1: add scoped query `listByStudent` |
| R6 | `next/font/google` egress blocks CI build | High (sandbox) | P2 | Document fixture (`NEXT_FONT_GOOGLE_MOCKED_RESPONSES`); no code change |
| R7 | Prisma `generate` blocked offline — new models cannot typecheck | High (sandbox) | P0-blocker for new Prisma delegates | Workaround: new tables via raw `pg` + hand-rolled stores; commit schema for future generation |
| R8 | ConceptState drift without event sourcing — state cannot be rebuilt | Certain (no event log) | P0 | Phase 1: append-only LearningEvent as source of truth |
| R9 | AI Mentor hallucinates progress/mastery | Certain (mock) | P1 | Phase 6: Context Builder + Validator, no LLM authority |

---

## 7. Dependency Map (domain → infra)

```
Assessment ─► AssessmentSessionStore ─► Prisma/Collection
Goal ─► GoalStore + AssessmentResultSource ─► Prisma/Collection
Roadmap ─► RoadmapStore + GoalLookup ─► Prisma/Collection + curriculum/graph
Execution ─► ExecutionStore + RoadmapLookup ─► Prisma/Collection + projection/evaluator
[NEW] Concept ─► ConceptStore ─► pg ( + Prisma schema for future)
[NEW] Evidence ─► EvidenceStore ─► pg + LearningEvent append
[NEW] ConceptState ─► ConceptStateStore + Evidence ─► pg + MasteryEngine
[NEW] Mastery/Diagnosis ─► pure functions over ConceptState + Evidence
[NEW] Adaptive ─► deterministic policy over Goal/Roadmap/States/Diagnosis
[NEW] Recall ─► RecallScheduleStore ─► pg, interval policy
[NEW] Tests ─► TestAttemptStore ─► pg, server grading
All ─► LearningEventStore (append-only) ─► pg
```

---

## 8. Phase Execution Order (enforced)

1. **Phase 0 (this doc):** no code change — DONE.
2. **Phase 1:** Concept + LearningEvent + Evidence + ConceptState (migrations, stores, ports, contract tests).
3. **Phase 2:** MasteryEngine + DiagnosisEngine (deterministic, tested).
4. **Phase 3:** AdaptiveEngine + NextLearningAction + WhyThisAction.
5. **Phase 4:** Server-authoritative Tests + Recall scheduling.
6. **Phase 5:** RecoveryEngine + BehaviorEngine.
7. **Phase 6:** AI Mentor with real context + validator + safety fences.
8. **Phase 7:** Hardening (security headers, rate limit doc, observability, privacy, backup doc, deployment verification).
9. **Phase 8:** Critical E2E (Register→Verify→Login→Assessment→Goal→Roadmap→Execute→Evaluate→Mastery→Adaptive→Recall).

No step may claim PASS while a prior P0 remains MOCK in the prod path.

---

## 9. Decision Log (no assumptions)

- Keep Prisma schema additive only; raw SQL migrations author new tables so `prisma generate` being blocked does not block feature progress.
- New learning-intelligence tables will be accessed via `pg` Pool in this phase; Prisma delegates will be added to schema for documentation and will become live when generation is available — no behavior difference to the caller (port abstraction).
- Concept catalog is derived from `curriculum.ts` CapabilityTemplates (source of truth), expanded into first-class Concept rows — avoids two competing ontologies.
- Evidence is generic (one row per observed action) — LearningUnitExecution remains the execution view; Evidence is the intelligence substrate that feeds ConceptState.
- Scores are floats 0–1 internally (domain precision), mapped to 0–100 only at API serialization boundary.
