# API Reference

Base: same origin. All `/api/*` routes are `ƒ` dynamic (no static prerender). Auth via `__session` cookie (HttpOnly). Errors are `{ code, message }`; on 400 the `code` is `validation_error`. Intelligence and core routes share `withStudent` (401 if unauthenticated) / `withAdmin` (403 if not admin).

See `docs/ENDPOINT_INVENTORY.md` for the Phase 3 filesystem-verified handler counts.

## Index

- Core: Health, Auth (8), Admin (10)
- Loop: Assessment (9), Goals (7), Roadmaps (5), Execution (5)
- Intelligence (Phase 4): Concepts, ConceptStates, Mastery, Diagnosis, Adaptive, Recall (2), Evidence (2), LearningEvents, Tests (3), Behavior, Recovery, Mentor (2), Privacy (2)

---

## Health

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| GET | `/api/health` | public | — | `{ status:"ok", service, time }` liveness only; never queries DB |

## Auth

| Method | Path | Auth | Body | Returns |
|---|---|---|---|---|
| POST | `/api/auth/register` | public | `{ email,password,nationalId?,invitationCode }` Zod | `201 { id,email }`; creates `pending` user + verification token |
| POST | `/api/auth/login` | public | `{ email,password }` | `200 { user }` + `Set-Cookie: __session` |
| POST | `/api/auth/logout` | cookie? | — | clears cookie |
| GET | `/api/auth/session` | cookie? | — | `{ user }` or 401 |
| POST | `/api/auth/forgot-password` | public | `{ email }` | 200 generic (enumeration-resistant) + outbox row |
| POST | `/api/auth/reset-password` | public | `{ token,newPassword }` | transactional password update + session revoke |
| POST | `/api/auth/verify-email` | public | `{ token }` 1..512 chars | `verified|already-verified|expired|invalid` |
| POST | `/api/auth/resend-verification` | public | `{ email }` | 200 generic; rate-limited |

## Admin (withAdmin)

All `GET /api/admin/*` bounded: users 200, invitations 200, audit 100, outbox 30.

`GET /api/admin/users`, `POST /api/admin/users-status`, `POST /api/admin/users-unlock`, `POST /api/admin/sessions-revoke`, `GET /api/admin/summary`, `GET /api/admin/audit`, `GET /api/admin/invitations`, `POST /api/admin/invitations`, `POST /api/admin/invitations-revoke`, `GET /api/admin/outbox`.

## Assessment

| Method | Path | Auth | Returns |
|---|---|---|---|
| POST | `/api/assessment/sessions` | student | 201 AssessmentSession (public projection; answer keys server-only) |
| GET | `/api/assessment/sessions/active` | student | session or null |
| GET | `/api/assessment/sessions/:sessionId` | student, owner | session; foreign 404 |
| POST | `/api/assessment/sessions/:sessionId/answers` | owner | validates `submitAnswerSchema`, idempotent by `submissionId` |
| POST | `/api/assessment/sessions/:sessionId/pause` | owner | transition |
| POST | `/api/assessment/sessions/:sessionId/resume` | owner | transition |
| POST | `/api/assessment/sessions/:sessionId/complete` | owner | complete → result readable |
| GET | `/api/assessment/sessions/:sessionId/results` | owner | AssessmentResult (strengths/gaps/confidence) |
| GET | `/api/assessment/results/latest` | student | latest result or null |

`POST /api/assessment/generate` is DEAD/removed (exposed scoring).

## Goals

| Method | Path | Returns |
|---|---|---|
| POST | `/api/goals` | 201 `GoalWithValidation`; diagnosis server-attached; idempotent by key |
| GET | `/api/goals/active` | current goal or null |
| GET | `/api/goals/:goalId` | goal; foreign 403, missing 404 |
| PATCH | `/api/goals/:goalId` | refinement |
| GET | `/api/goals/:goalId/validation` | `GoalValidationResult` |
| POST | `/api/goals/:goalId/lock` | lock transition |
| POST | `/api/goals/:goalId/revise` | 201 new version; old stays as history |

All validate with `goal-api.ts`; no `status` writable; `studentId` from cookie only.

## Roadmaps

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/roadmaps/active` | — | live roadmap or null |
| POST | `/api/roadmaps/generate` | `{ goalId }` only | 201/200 planner result; goal must be owned + locked |
| GET | `/api/roadmaps/:roadmapId` | — | full tree; foreign 404 |
| POST | `/api/roadmaps/:roadmapId/pause` | — | transition |
| POST | `/api/roadmaps/:roadmapId/resume` | — | transition |

`generationKey = (studentId,goalId,goalVersion,engineVersion)` unique.

## Execution

| Method | Path | Returns |
|---|---|---|
| GET | `/api/executions/view` | derived view or null |
| GET | `/api/executions/units/:learningUnitId/context` | unit+milestone+execution+status+next; no active plan ⇒ domain error |
| POST | `/api/executions/units/:learningUnitId/start` | dependency-gated start |
| POST | `/api/executions/units/:learningUnitId/evidence` | evidence only; verdict ignored |
| POST | `/api/executions/units/:learningUnitId/evaluate` | server-derived verdict |

---

## Intelligence (Phase 4)

All intelligence routes are `withStudent`. No `studentId` in body ever trusted.

### Concepts & States

| Method | Path | Query | Returns |
|---|---|---|---|
| GET | `/api/concepts` | — | `Concept[]` catalog |
| GET | `/api/concept-states` | — | `ConceptState[]` for caller (masteryEstimate, confidence, evidenceCount, misconceptionRisk) |
| GET | `/api/learning-events` | `?conceptId=&limit=` | `LearningEvent[]` chronological |

### Mastery & Diagnosis & Adaptive

| Method | Path | Returns | Notes |
|---|---|---|---|
| GET | `/api/mastery` | `MasteryViewItem[] { conceptId,conceptName,domain,state,diagnosis,achieved }` | derived via `intelligence-application.getMasteryView` |
| GET | `/api/diagnosis` | `ConceptDiagnosis[] { conceptId,issue,severity,statement }` | 9 issues |
| GET | `/api/adaptive/next` | `AdaptiveDecision { primary:Action{REMEDIATE|RETRIEVE|REVIEW|TRANSFER|PRACTICE|ADVANCE}, alternatives[≤3], evaluatedAt }` | query `?goalId=&roadmapId=&currentUnitId=` optional |

`mastery` and `diagnosis` are projections, never persisted; `adaptive` is recomputed from states+diagnoses+recall due.

### Recall

| Method | Path | Returns |
|---|---|---|
| GET | `/api/recall/schedules` | all schedules for caller |
| GET | `/api/recall/schedules?due=true` | due schedules (`dueAt ≤ now`) with Concept |
| POST | `/api/recall/review` | body `{ conceptId, quality 0..5 }` → updated `RecallSchedule`; evidence `kind=recall_review` appended |

SM-2 intervals: ease 1.3..2.8, repetition tracking, relearning on quality ≤2.

### Evidence

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/evidence` | — | `Evidence[]` for caller |
| POST | `/api/evidence` | `CreateEvidenceInput{ conceptId?, kind, payload, score?, timeSpentSeconds?, hintCount?, ... }` Zod | `201 Evidence`; increments `ConceptState.evidenceCount` and updates `masteryEstimate` via `submitEvidence` |

Evidence is the substrate for mastery/recall/behavior.

### Tests (server-authoritative)

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/tests` | — | `TestDefinition[]` (questions with `correctChoiceIndex` / rubric — server only; client receives them but grading ignores client `correct`) |
| GET | `/api/tests/attempts` | — | `TestAttempt[]` for caller |
| GET | `/api/tests/:testId` | — | single `TestDefinition` |
| POST | `/api/tests/:testId/submit` | `{ answers:[{questionId,choiceIndex?,text?}], timeSpentSeconds }` | `TestAttempt { score, gradedAnswers, strongTopics, needsReviewTopics, recommendation }` graded server-side; `recommendation` `continue|review|recovery` |

Grading ignores any `correct` from client; MC uses `correctChoiceIndex`, `short_answer` uses rubric keywords.

### Behavior & Recovery

| Method | Path | Returns | Notes |
|---|---|---|---|
| GET | `/api/behavior` | `BehaviorInsights { consistency, hintDependencyRate, averageDelayMinutes, studyBursts }` | observable only |
| GET | `/api/recovery` | `RecoveryPlan[] { strategy:reteach|prerequisite_repair|transfer_bridge|fluency_drill, triggerDiagnosis, steps:string[], estimatedMinutes }` | null when strong |

### Mentor

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/api/mentor/context` | — | `MentorContext { recentEvidences, diagnoses, currentGoal?, weakConcepts }` minimal slice |
| POST | `/api/mentor/chat` | `{ message }` | `{ reply, context, provider }`; rate-limited, Zod-validated, policy-checked (never declares mastery) |

Provider is `AIProvider` (Gemini) behind `mentor-context` builder; fallback is deterministic mock.

### Privacy

| Method | Path | Returns | Notes |
|---|---|---|---|
| GET | `/api/privacy/export` | ` { user, goals[≤50], roadmaps[≤20], evidences[≤100], events[≤100], conceptStates, attempts, recallSchedules }` | bounded JSON |
| POST | `/api/privacy/delete` | `204` + clears `__session` | cascades: `prisma.user.delete` (cascades) + explicit `pg` deletes for intelligence tables; returns 500 with `{ code, requestId }` on failure |

---

## Error Codes

| HTTP | Code | When |
|---|---|---|
| 400 | `validation_error` / `unknown` | Zod fail; no internal details leaked |
| 401 | account `invalid_credentials` etc | auth gateway |
| 403 | `forbidden` | non-admin or foreign goal |
| 404 | `not_found` / `goal_not_found` / `roadmap_not_found` | missing or foreign (roadmap/assessment use 404 to avoid existence leak) |
| 409 | `conflict` / `invalid_transition` | duplicate idempotency key / bad state transition |
| 422 | `evidence_invalid` | blank evidence |
| 423 | `account_locked` | lockout |
| 429 | `rate_limited` | IP/email bucket |
| 503 | `service_unavailable` | DB unavailable (explicit; never mock fallback) |
| 500 | `unknown` | unexpected; SQL not serialized |

All mutating routes are `POST`/`PATCH`; no `GET` mutates.

## Rate Limits

In-memory sliding window (see `docs/SECURITY.md`): login, register, verify-email, resend-verification, forgot-password, mentor chat, and assessment creation. Single-process today; multi-instance needs shared store (PRODUCTION_HARDENING).

## Client Usage

```ts
import { conceptService, masteryApiService, adaptiveService } from "@/services/intelligence-api.service";
const concepts = await conceptService.list();
const mastery = await masteryApiService.getView();
const decision = await adaptiveService.getNext({ goalId });
```

Hooks: `src/features/intelligence/hooks/use-learning-intelligence.ts` (`useMastery`, `useDiagnosis`, `useAdaptiveNext`, `useRecall`, `useTests`, `useBehavior`, `useRecovery`, `useMentor`).

