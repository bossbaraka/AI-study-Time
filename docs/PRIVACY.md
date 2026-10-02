# Privacy

## Data Collected (actual behavior, not policy text)

| Data | Stored where | Why | Retention |
|---|---|---|---|
| `User` (email, name, role, nationalId, status) | `User` table | Account + RBAC | Until account deletion |
| `Session` (hashed token, expiry) | `Session` table | Auth | Until logout/expiry |
| `AssessmentSession/Question/Answer` | Postgres | Diagnosis truth | Until student deletion |
| `Goal, Roadmap, Milestone, LearningUnit, LearningUnitExecution` | Postgres | Learning plan truth | Until student deletion |
| `ConceptState, Evidence, RecallSchedule, TestAttempt, LearningEvent` | Postgres | Intelligence truth (rebuildable from Evidence + Events) | Until student deletion |
| `AuditEvent` (type, actorId, IP, userAgent, meta) | Postgres | Security audit | 90 days, then aggregation |
| `OutboxMessage` | Postgres | Email delivery | 30 days after delivered |
| No cookies beyond `mureeh_session` (httpOnly). No third-party trackers. | — | — | — |

No `localStorage` is used for domain state outside the Vitest/browser mock runtime.

## Rights (technical support)

- **Account deletion:** `DELETE /api/privacy/delete` (student, authenticated) — cascades via FK `onDelete: Cascade` across all student-owned aggregates: sessions, goals, roadmaps, executions, evidences, states, events, recalls, test attempts, guardian relations. Implemented as a single `prisma.user.delete` (+ `_prisma_migrations` untouched). Audit retains anonymized `actorId→null` after 7 days.
- **Data export:** `GET /api/privacy/export` (student, authenticated) — returns JSON with `User, Goals, Roadmaps, Executions, ConceptStates, Evidence, LearningEvents, TestAttempts` for the caller. Bounded (latest 500 events, 200 evidences) to avoid unbounded allocations; pagination can be added when needed.
- **Data correction:** Goals/evidence are append-or-revise, not destructive edit; `Goal.revisesGoalId` preserves history.
- **Retention preference:** `PATCH /api/privacy/preferences` (deferred — documented but not yet implemented; current default is “collect minimal, retain until deletion”).
- **AI data disclosure:** Mentor context is built server-side from DB rows; GEMINI_API_KEY calls send only `{ goalTitle, weakConcepts, behavior, adaptiveRecommendation }` — never raw PII or full history. Without a key, MockAIProvider runs locally.

If a right is DEFERRED, the API returns `{ code:"feature_deferred", status:501 }`, not fake success.

## Guardian Boundaries

- `GuardianRelation` is explicit, status `pending|active|revoked`, created only by admin or verified invitation.
- Mentor/grade data is never exposed via `studentId` in query/body — it is always derived from the session.
- Guardian view (`/guardian`) shows minimal aggregate (goal, progress, no raw answers); raw evidence is student-only.

## Deletion Verification

```bash
# Create synthetic student, add evidence, delete
curl -X POST http://localhost:3000/api/privacy/delete -H "Cookie: mureeh_session=..."
# Assert 204 and that subsequent GET /api/concept-states returns 401 or empty after re-login fails
```

## Logging Privacy

`observability.ts` redacts `password, token, cookie, secret, authorization, hash` keys and never logs full payloads. Event payloads in `LearningEvent` store minimal structured data, not full PII paragraphs.

## Policy Accuracy

This document describes *actual* behavior. Do not claim “backups are encrypted at rest” or “data is anonymized after 30 days” unless verified with the provider. Privacy Policy page must link here and not contradict the table above.
