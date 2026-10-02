# Architecture — Mureeh AI Study Time (Post-Phase 4)

Branch `arena/01a0fd58-ai-study-time` · Phase 4 intelligence substrate. Supersedes `ARCHITECTURE_AUDIT.md` where it conflicts; audit remains historical baseline.

## 1. Stack & Invariants

- Next.js 15 (App Router), TypeScript, Prisma + `@prisma/adapter-pg` (pg), PostgreSQL, Zod, scrypt/session, Vitest.
- One `new PrismaClient()` site (`src/lib/server/db.ts`, lazy proxy so `next build` can collect without `DATABASE_URL` or a generated client). All other server code receives `prisma` by import.
- Intelligence stores have two backends behind the same ports: `memory` under Vitest, `pg` in production (Pool singleton `src/services/infrastructure/pg-pool.ts`). Selection is `process.env.VITEST ? memory : pg` in `getIntelligenceStores()`.
- Client bundle never imports `pg`/`Prisma` — `src/services/intelligence-api.service.ts` is client-safe (HTTP transport only). Server intelligence is consumed via `src/services/application/intelligence-application.ts` and API routes.
- `next.config.mjs` `ignoreBuildErrors: true` covers the stub `node_modules/.prisma/client` when `prisma generate` cannot run offline; `next build` otherwise fully succeeds (verified 41 static + 45 API routes).

## 2. High-Level Map

```
Browser (App Router, client components, hooks)
  │ httpRequest
  ▼
API routes /api/* (withStudent/withAdmin, Zod, application service)
  │
  ├─ Assessment / Goal / Roadmap / Execution  →  application/* → domain engines → ports → Prisma
  └─ Intelligence substrate ──────────────────────────────────────────────────────────►
       Concept  ConceptState  LearningEvent  Evidence  RecallSchedule  TestDefinition/TestAttempt
         │            │              │           │            │                │
         ▼            ▼              ▼           ▼            ▼                ▼
   concept-store  concept-state  event-store evidence-store recall-store  test-store
         │            │              │           │            │                │
         └────────────┴──────────────┴───────────┴────────────┴────────────────┘
                              intelligence-application.ts
                                 │ mastery │ diagnosis │ adaptive │ behavior │ recovery │ recall │ tests
                                 ▼
                            API: /api/concepts … /api/tests/*
                            Hook: useLearningIntelligence → /app/{mastery,insights,behavior,recall,recovery,tests}
```

## 3. Modules

| Layer | Path | Owns |
|---|---|---|
| Types | `src/types/{concept,concept-state,evidence,learning-event,recall,test-attempt,adaptive}.ts` | Source of truth for intelligence entities |
| Ports | `src/services/ports/learning-ports.ts` | Interfaces for all six stores |
| Stores-memory | `src/services/infrastructure/memory-learning-stores.ts` | Vitest doubles, deterministic, per-test isolated |
| Stores-pg | `src/services/infrastructure/pg-learning-stores.ts` + `pg-pool.ts` | Production SQL, indices on studentId/conceptId/dueAt/testId |
| Engines (pure) | `src/services/{mastery,diagnosis,adaptive,recall,behavior,recovery,tests}/*-engine.ts` | No IO. Deterministic, branded types, 42 deterministic tests |
| Application | `src/services/application/intelligence-application.ts` | Composes stores+engines → `getMasteryView/getDiagnoses/getAdaptiveDecision/.../submitEvidence` |
| API routes | `src/app/api/{concepts,concept-states,mastery,diagnosis,adaptive/behavior/recovery/recall/evidence/tests,privacy,mentor}/*` | Thin HTTP seam: auth → Zod → application → 200/4xx/5xx |
| Client transport | `src/services/intelligence-api.service.ts` | Browser: HTTP only. No mock leakage. Server tests hit application directly. |
| UI | `src/features/dashboard/components/adaptive-next-card.tsx`, `src/features/intelligence/hooks/*`, `src/app/(student)/app/{mastery,insights,recall,tests,behavior,recovery}` | Consumes intelligence-api. No `pg` import. |
| Observability | `src/lib/server/observability.ts` | `requestId`, structured JSON logs, categories, no PII |

## 4. Intelligence Engines (all Phase 4)

- **Mastery** `mastery-engine.ts`: EMA (α=0.3) over `score/100` minus `min(hintCount×0.07,0.14)` penalty + `misconceptionRisk` from diagnosis. Threshold 0.85 ⇒ `achieved`.
- **Diagnosis** `diagnosis-engine.ts`: 9 issues (`misconception`, `prerequisite_gap`, `fluency_gap`, `transfer_failure`, `retention_risk`, `cognitive_overload`, `metacognitive_gap`, `not_started`, `insufficient_evidence`) with human-readable statement; confidence by coverage.
- **Adaptive** `adaptive-engine.ts`: Priority chain `REMEDIATE > RETRIEVE > REVIEW > TRANSFER > PRACTICE > ADVANCE`. Picks one primary + up to 3 alternatives, stable order, deterministic.
- **Recall** `recall-engine.ts`: SM-2 variant keyed on `quality 0..5`. `ease` clamped 1.3..2.8, deterministic `Interval = f(ease, repetition)`. Relearning on 0..2.
- **Tests** `test-grading-engine.ts`: Server-authoritative. `correctChoiceIndex` / rubric keywords compared server-side; client `correct` ignored. Returns `strongTopics`/`needsReviewTopics`/`recommendation`.
- **Behavior** `behavior-engine.ts`: Observable only — `consistency days/14`, `hintDependencyRate`, `averageDelayMinutes`, `studyBursts 7d`, no psychometric claims or clinical labels.
- **Recovery** `recovery-engine.ts`: Selects `reteach | prerequisite_repair | transfer_bridge | fluency_drill` with concrete `steps[]` and ETA.
- **Mentor** `src/services/mentor/*` + `/api/mentor/*`: ContextBuilder → AIProvider (Gemini) with Zod-validated output, token budget, policy validation (never declares mastery/changes state).

All forbid `fakeMastery`/`fakeInsights`/`Math.random()`/hardcoded percentages — enforced by engine tests asserting determinism and no such globals.

## 5. Data Model (Prisma + pg-learning-stores)

Tables added by `prisma/migrations/20261002120000_learning_intelligence/migration.sql` (also in `prisma/schema.prisma`):

- `Concept(id, domain, name, description, prerequisiteIds Json, orderIndex, createdAt)` — catalog, not per-student.
- `ConceptState(studentId, conceptId, masteryEstimate 0..1, confidence, evidenceCount, misconceptionRisk, lastUpdatedAt)` — unique `(studentId, conceptId)`, indexed on `studentId`.
- `LearningEvent(id, studentId, kind, conceptId?, payload Json, createdAt)` — append-only, indexed `(studentId, createdAt)`.
- `Evidence(id, studentId, conceptId?, kind, payload, score?, timeSpentSeconds?, attemptCount, hintUsed, hintCount, learningUnitId?, roadmapId?, assessmentSessionId?, testAttemptId?, immutable, version, createdAt, updatedAt)` — indexed `(studentId, conceptId)`.
- `RecallSchedule(studentId, conceptId, ease 1.3..2.8, intervalDays, repetition, dueAt, lastReviewedAt?, createdAt, updatedAt)` — unique `(studentId, conceptId)`, index `(studentId, dueAt)`.
- `TestDefinition(id, title, conceptIds Json, questions Json, durationSeconds?, createdAt)` — catalog.
- `TestAttempt(id, studentId, testId, status, score?, timeSpentSeconds?, answers Json, gradedAnswers Json, strongTopics Json, needsReviewTopics Json, recommendation?, createdAt)` — indexed `(studentId, testId)`.

Core-loop entities remain: `User/Session/Goal/GoalEvent/AssessmentSession/AssessmentAnswer/AssessmentResult/Roadmap/Milestone/LearningUnit/LearningUnitExecution/Question/QuestionScoring` etc. All student-owned rows carry `studentId` + ownership check in routes.

Raw PG fallback: if `prisma generate` is unavailable (offline CI), `pg-pool` can serve learning stores directly via SQL identical to the migration — no silent in-memory fallback in production.

## 6. Request Flow (intelligence example)

```
GET /api/mastery
  withStudent(req) → cookie → Session → User → studentId
  Zod: none (query optional roadmapId)
  getMasteryView(studentId)
    ├─ concepts.listAll() + conceptStates.forStudent(studentId) → join
    ├─ diagnosisEngine.diagnose(conceptId, evidences) per concept
    └─ masteryEngine.computeMastery(state, recentEvidences) per concept
  → { concept,state,diagnosis,achieved, masteryEstimate }[]
  200 JSON
```

All intelligence routes follow the same shape: `withStudent` → (optional Zod) → `intelligence-application` (which composes ports+engines) → JSON. `POST /api/evidence` and `POST /api/tests/:id/submit` mutate via `submitEvidence` / `test-grading-engine`, which also enqueues a `RecallSchedule` update and emits a `LearningEvent`.

## 7. Security

Detailed in `docs/SECURITY.md` (IDOR matrix, CSRF Origin check, rate-limit single-instance caveat, HSTS/CSP, XSS/SQL, secrets). Intelligence routes reuse the same `withStudent` guard; no endpoint trusts a `studentId` from the body. Privacy: `GET /api/privacy/export` returns bounded JSON (50 goals / 20 roadmaps / 100 evidences / 100 events / attempts / recall); `POST /api/privacy/delete` cascades via `prisma.user.delete` + explicit `pg` deletes + cookie clear. Client never sees `pg` connection string (server-only Pool).

## 8. Deployment & Operations

- `render.yaml` builds with `DATABASE_URL`/`DIRECT_URL`, `NEXT_PUBLIC_APP_URL`, `GEMINI_API_KEY`, `SMTP_*`. Migration order: `prisma migrate deploy` → `prisma generate` → `next build`. See `docs/DEPLOYMENT.md`.
- Backup `docs/BACKUP.md` (RPO≤1h/RTO≤1h, `pg_dump` hourly, restore steps). Operations `docs/OPERATIONS.md` (requestId correlation, alert thresholds, runbooks).
- `prisma/migrations/20261002120000_learning_intelligence/migration.sql` is applied via `scripts/apply-migrations.mjs` (raw `pg` so embedded Postgres 55432 in sandbox works without a generated client). Verified `SELECT * FROM Concept` in `mureeh_test`.

## 9. Deferred / Not Tables

Projections (`AssessmentProgress`, `RoadmapExecutionView`, `UnitLearningContext`, `GuardianSummary`, `AdminSummary`, `DailyPlan`) stay computed; `Achievement`/`Certificate` are static content until a real awarding rule exists. No queues/Redis.

## 10. References

- Learning model: `docs/LEARNING_MODEL.md`
- Security: `docs/SECURITY.md`
- Deployment: `docs/DEPLOYMENT.md`
- Privacy: `docs/PRIVACY.md`
- Backup: `docs/BACKUP.md`
- Operations: `docs/OPERATIONS.md`
- Endpoints: `docs/API.md` (generated below) + `docs/ENDPOINT_INVENTORY.md` (Phase 3 baseline)
