# Endpoint Inventory — Phase 1 (§43.8)

Generated from the code, not from documentation: every row is a path a service
actually calls (`httpRequest` / `mockRequest`) cross-referenced against the
route files that exist under `src/app/api`.

**Read this before implementing anything.** The dependency order is fixed —
Assessment → Goal → Roadmap → Execution — because each layer's contract
consumes the previous layer's persisted output. Execution must not start
before Roadmap exists, and Roadmap must not start before Goal exists.

## Coverage at the end of Phase 1

| Domain | Service calls | Routes that exist | Missing |
|---|---|---|---|
| Auth | 8 | 8 | 0 |
| Admin | 10 | 9 (one route serves GET+POST `/invitations`) | 0 |
| **Assessment** | **9** | **9** | **0 — completed in Phase 1** |
| Goal | 7 | 0 | **7** |
| Roadmap | 5 | 0 | **5** |
| Execution | 5 | 0 | **5** |
| **Total** | **44** | **26** | **17** |

`GET /api/health` exists and is called by nothing.

## Legend

- **Auth** — must a signed-in user be present?
- **Ownership** — must the handler verify the resource belongs to the caller?
  Every "yes" here is enforced by `withStudent` resolving `studentId` from the
  session cookie; a client-supplied id is never read.
- **Persistence** — does the endpoint need a durable store? All "yes" rows are
  currently served by the in-process mock adapters behind the Phase 1 ports,
  and become Prisma repositories in Phase 2.
- **Domain** — is there real domain logic behind it (not a CRUD passthrough)?

---

## Assessment — COMPLETE (built in Phase 1)

| Endpoint | Consumer | Expected contract | Status | Auth | Own | Persist | Domain |
|---|---|---|---|---|---|---|---|
| `POST /api/assessment/sessions` | `assessmentService.createSession` → `use-assessment` → `AssessmentIntro` | `{ profile? }` → `201 AssessmentSession` | ✅ | student | n/a (creates own) | yes | question generation + selection |
| `GET /api/assessment/sessions/active` | `getActiveSession` → `AssessmentIntro` resume prompt | → `AssessmentSession \| null` | ✅ | student | yes | yes | — |
| `GET /api/assessment/sessions/:sessionId` | `getSession` → `AssessmentRunner` | → `AssessmentSession`, `404 session_not_found` | ✅ | student | yes | yes | — |
| `POST /api/assessment/sessions/:sessionId/answers` | `submitAnswer` → `AssessmentRunner` | `SubmitAnswerPayload` → `AssessmentSession`, `400/404/409/422` | ✅ | student | yes | yes | **server-side grading** |
| `POST /api/assessment/sessions/:sessionId/pause` | `pauseSession` | → `AssessmentSession` | ✅ | student | yes | yes | status transition |
| `POST /api/assessment/sessions/:sessionId/resume` | `resumeSession` | → `AssessmentSession` | ✅ | student | yes | yes | status transition |
| `POST /api/assessment/sessions/:sessionId/complete` | `completeSession` | → `AssessmentSession` | ✅ | student | yes | yes | status transition + diagnosis gate |
| `GET /api/assessment/sessions/:sessionId/results` | `getResults` → `AssessmentResults` | → `AssessmentResult`, `409 assessment_not_completed` | ✅ | student | yes | yes | diagnostic synthesis |
| `GET /api/assessment/results/latest` | `getLatestCompletedResult` → goal discovery hand-off | → `AssessmentResult \| null` | ✅ | student | yes | yes | — |

**Removed in Phase 1:** `POST /api/assessment/generate`. It was unauthenticated,
unvalidated, unrate-limited, and returned the generated bank including
`scoring.correctOptionId`. Question generation moved inside
`POST /api/assessment/sessions`; only the public question projection is served.

---

## Goal — MISSING (implement first, Phase 3)

Engine already exists and is fully tested: `createGoalEngine` (31 tests).
Handlers are thin `withStudent` wrappers over it.

| Endpoint | Consumer | Expected contract | Status | Auth | Own | Persist | Domain |
|---|---|---|---|---|---|---|---|
| `GET /api/goals/active` | `getActiveGoal` → `use-goal-discovery` → `/goals` | → `LearningGoal \| null` | ❌ 404 | student | yes | yes | active-goal projection |
| `POST /api/goals` | `createGoal` → `GoalDiscoveryFlow` | `GoalDiscoveryInput` + idempotency key → `201 GoalWithValidation` | ❌ 404 | student | n/a (creates own) | yes | validation, heuristics, idempotency, **resolves `diagnosisContext` server-side** |
| `GET /api/goals/:goalId` | `getGoal` → goal detail | → `LearningGoal`, `403 forbidden` | ❌ 404 | student | yes | yes | — |
| `PATCH /api/goals/:goalId` | `updateGoal` → edit form | partial patch → `LearningGoal`, lock-protected | ❌ 404 | student | yes | yes | lock protection, re-validation |
| `GET /api/goals/:goalId/validation` | `validateGoal` → live form feedback | → `GoalValidation` | ❌ 404 | student | yes | no (pure) | validation rules |
| `POST /api/goals/:goalId/lock` | `lockGoal` → confirm step | → `LearningGoal`, idempotent | ❌ 404 | student | yes | yes | state machine `validated → locked` |
| `POST /api/goals/:goalId/revise` | `reviseGoal` → revise flow | → new goal version | ❌ 404 | student | yes | yes | state machine + version bump |

**Blocking decision to carry into Phase 3:** `GET /api/goals/:goalId` currently
answers **403 `forbidden`** for a non-owner while assessment and roadmap answer
**404**. The 403 is preserved deliberately — four existing assertions depend on
it (`mock-goal-engine.test.ts:337,338`, `goal-discovery.service.test.ts:49,102`)
— and changing it is a public API contract change. Unifying on 404 (existence
must not leak) is the recommended Phase 3 decision, taken explicitly.

---

## Roadmap — MISSING (implement second, Phase 3)

Engine exists and is fully tested: `createRoadmapEngine` (32 tests), including
the 10-step generation pipeline, `validateRoadmapStructure()` pre-persist gate
and the deterministic Kahn topological sort.

| Endpoint | Consumer | Expected contract | Status | Auth | Own | Persist | Domain |
|---|---|---|---|---|---|---|---|
| `GET /api/roadmaps/active` | `getActiveRoadmap` → `use-roadmap` → `/roadmap` | → `Roadmap \| null` | ❌ 404 | student | yes | yes | — |
| `POST /api/roadmaps/generate` | `generateRoadmap` → post-lock hand-off | `{ goalId }` → `RoadmapGenerationResult`, idempotent per `generationKey` | ❌ 404 | student | **yes — must verify the goal is the caller's and is `locked`** | yes | full generation pipeline + structure validation |
| `GET /api/roadmaps/:roadmapId` | `getRoadmap` → roadmap detail | → `Roadmap`, `404 roadmap_not_found` | ❌ 404 | student | yes | yes | — |
| `POST /api/roadmaps/:roadmapId/pause` | `pauseRoadmap` | → `Roadmap` | ❌ 404 | student | yes | yes | state machine |
| `POST /api/roadmaps/:roadmapId/resume` | `resumeRoadmap` | → `Roadmap` | ❌ 404 | student | yes | yes | state machine |

**Dependency:** `POST /api/roadmaps/generate` takes a `goalId` from the client.
The handler must load that goal **through the goal repository scoped to the
authenticated student** and reject it otherwise — never trust that the id
belongs to the caller.

---

## Execution — MISSING (implement last, Phase 3)

Engine exists and is fully tested: `createExecutionEngine` (29 tests) plus the
pure `execution-projection.ts` (19 tests) and `development-evaluator.ts`.

| Endpoint | Consumer | Expected contract | Status | Auth | Own | Persist | Domain |
|---|---|---|---|---|---|---|---|
| `GET /api/executions/view` | `getExecutionView` → `use-execution` → learn screen | → `RoadmapExecutionView \| null` | ❌ 404 | student | yes (resolved from the caller's active roadmap) | yes | derived unit statuses, `currentUnit` |
| `GET /api/executions/units/:learningUnitId/context` | `getUnitContext` → `UnitLearnFlow` | → `UnitLearningContext`, `unit_unavailable` | ❌ 404 | student | yes | yes | unit + milestone + roadmap resolution |
| `POST /api/executions/units/:learningUnitId/start` | `startLearningUnit` | → `LearningUnitExecution` | ❌ 404 | student | yes | yes | state machine |
| `POST /api/executions/units/:learningUnitId/evidence` | `submitEvidence` → evidence form | `LearningEvidence` → `LearningUnitExecution`, `evidence_invalid` | ❌ 404 | student | yes | yes | **evidence policy — server grades, client never self-reports a pass** |
| `POST /api/executions/units/:learningUnitId/evaluate` | `evaluateExecution` | → `LearningUnitExecution` with `passed \| needs_review \| failed` | ❌ 404 | student | yes | yes | `EVIDENCE_POLICY` evaluation |

**Why last:** every execution method resolves the caller's *active roadmap*
first. Without a persisted roadmap owned by the student there is nothing to
execute against, and `unit_unavailable:no_active_roadmap` is the correct — not
a bug — outcome.

---

## Still unrepresented in any service (Phase 4+)

These are consumed only by the mock-only services (`journey`, `learning`,
`engagement`, `intelligence`, `mastery`, `recall`, `test`, `recovery`) which
have **no HTTP path at all** — `mockRequest` count 9/7/12/11 with zero
`httpRequest` calls. They are out of Phase 3 scope and must not be wired
before their domain models are settled:

| Area | Note |
|---|---|
| `masteryService` | Returns static `mocks/data.ts` rows. Mastery must become **derived state** before it gets an endpoint (§ Phase 4). |
| `recallService` | Self-rated confidence drives the interval multipliers (2.2/1.4/0.6); `dueToday` is a boolean. Needs a real scheduling model first. |
| `testService` | `TestResultAnswer.correct` is **client-supplied** — the same defect class fixed for assessment in Phase 1. Must be server-graded before it gets an endpoint. |
| `recoveryService` | `advanceStep()` has no transition guard. Needs a state machine first. |
| `journey` / `learning` / `engagement` / `intelligence` | Read-model aggregations over `mock-db.ts`. Contract depends on the Phase 2 schema. |
