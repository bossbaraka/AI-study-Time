# Learning Intelligence Model

## Core Loop

```
Assessment
  ↓
Learner Model (ConceptState)
  ↓
Goal
  ↓
Roadmap
  ↓
Learning Unit
  ↓
Evidence
  ↓
Evaluation
  ↓
ConceptState Update (MasteryEngine)
  ↓
Diagnosis
  ↓
Adaptive Decision
  ↓
Next Learning Action
  ↓
New Evidence
  ↓
Updated ConceptState
```

Every transition after **Evidence** is deterministic and server-authoritative. The client never decides mastery, diagnosis, or next action.

---

## Concepts vs Learning Units vs Evidence

| Entity | Definition | Example |
|---|---|---|
| **Concept** | What is learned — a stable node in the ontology with prerequisites and difficulty (1..5). Global, versioned. | `concept_js_closures` — Closures |
| **LearningUnit** | What the student DOES — a step inside a Milestone (learn/practice/build/review/reflect/assess). Owned by a Roadmap, ordered, dependency-gated. | `unit_js.scope_closures_practice` |
| **Evidence** | What the student PROVED — one row per observable action (answer, reasoning, solution, code, quiz result, recall result, transfer result, hint usage). Student-owned, timestamped, traceable, immutable after evaluation when appropriate. | `{ kind: "solution", score: 0.8 }` |

A LearningUnit *teaches* a Concept; Evidence *proves* something about a Concept; ConceptState *tracks* mastery of a Concept for one student.

---

## ConceptState — Decomposed Mastery Vector

Not a single percentage. Each dimension is 0..1 with a source:

```ts
ConceptState {
  conceptId, studentId,
  knowledge,      // understanding
  retrieval,      // recall under test
  retention,      // stability over time
  transfer,       // applying to new problems
  fluency,        // speed + accuracy
  confidence,     // calibration
  hintDependency, // reliance on hints
  misconceptionRisk,
  evidenceCount, lastEvidenceAt, stateVersion
}
```

Every score has an update rule (see `mastery-engine.ts`), a source evidence id, and a timestamp.

---

## Mastery Engine

Pure function: `Evidence + previous ConceptState → next ConceptState`

Rules (deterministic):
- `knowledge`: EMA of `score`, alpha 0.5 (first) / 0.3 (later), halved if hint used.
- `retrieval`: weighted by `kind` (recall 1.0, quiz 0.9, answer 0.8).
- `retention`: decays if gap >7 days, then EMA toward retrieval.
- `transfer`: only improves on transfer-type evidence; otherwise drifts toward retrieval.
- `fluency`: target based on score + timeSpent (≤90s →1.0, ≤180s→0.7, else 0.5).
- `confidence`: slow EMA (0.25) toward score.
- `hintDependency`: +0.2 on hint, -0.08 without, +0.05 if attemptCount>2.
- `misconceptionRisk`: +0.25 if knowledge high but new score low, -0.15 if correct without hint.

No `Math.random()`, no LLM, no client-provided score.

---

## Diagnosis Engine

Input: `ConceptState + Concept + prerequisiteStates`

Output: `ConceptDiagnosis { level: strong|developing|weak|not_started, issues: [...] }`

Issues (human-mapped, not shown as codes):
- `retrieval_gap`: knowledge − retrieval >0.3
- `retention_gap`: knowledge − retention >0.3
- `transfer_gap`: knowledge≥0.6 and knowledge−transfer>0.3
- `fluency_gap`: knowledge≥0.6 and knowledge−fluency>0.3
- `confidence_mismatch`: |confidence−knowledge|>0.3
- `hint_dependency`: hintDependency≥0.5
- `misconception`: misconceptionRisk≥0.5
- `prerequisite_gap`: weak/missing prereq while not strong
- `strength` / `weakness` (overall level)

Language: “Knowledge is present but retrieval is weak” — not “You don’t understand.”

---

## Adaptive Engine

Deterministic policy, priority-sorted:

1. `prerequisite_gap` → **REMEDIATE**
2. `misconception` → **REMEDIATE**
3. `retrieval_gap` → **RETRIEVE**
4. `retention_gap` → **REVIEW**
5. `transfer_gap` with knowledge high → **TRANSFER**
6. `fluency_gap` with knowledge high → **PRACTICE**
7. `hint_dependency` → **PRACTICE** (without hints)
8. `weakness` → **EXPLAIN**
9. `strength` with stable retention+transfer → **ADVANCE**, else **TRANSFER**
10. otherwise → **PRACTICE** (or **REST** as alternative if streak>5 and recentEvidence>8)

Plus `EXPLAIN` fallback when no evidence. Recovery overrides (priority 100). Every action carries `reason` (“Why am I seeing this?”) and `priority` (0..100).

LLM is never the authority — it only verbalizes the chosen action.

---

## Evidence Model

Fields: `answer, reasoning, solution, code, explanation, quiz result, recall result, transfer result, hint usage, time spent, attempt count`

Validation: `kind` allowlist, non-empty payload, score 0..1, `studentId` always from session. Immutable after evaluation where appropriate, versioned where revision matters.

---

## Recall Engine

Evidence-driven SM-2 variant, not self-rated `interval*2.2`.

- `scheduleNew`: interval 1, ease 2.5, state `new`, due tomorrow.
- `review(quality 0..5)`: ease = clamp(ease + (0.1 − (5−q)*(0.08+(5−q)*0.02)), 1.3, 2.8); intervals grow on success, reset to 1/relearning on failure (q<3).
- `quality` mapping: 5 perfect → 90%→100% score, 3 correct with difficulty → 0.7, 0→0.
- No client-provided interval; server decides `dueAt`.

---

## Tests — Server-Authoritative

Browser sends: `answers: [{questionId, choiceIndex?, answer?, reasoning?}], timeSpentSeconds`

Server grades via `test-grading-engine.ts` against stored `correctChoiceIndex` / `rubric keywords`. Returns: `gradedAnswers, score 0..100, strongTopics, needsReviewTopics, recommendation`. The schema never accepts `correct: boolean` or `score` from the client — verified by the grading test “server-authoritative: ignores client-provided correct”.

---

## Behavior Engine

Input: `LearningEvent[]` filtered by student.

Output (observable only): `consistency (days active/14), sessionAbandonmentRate, hintDependencyRate, studyBursts histogram, repeatedFailureConcepts, recoveryAttempts, recentEventsCount`.

No personality or clinical language.

---

## Recovery Engine

Trigger: weak/misconception/prerequisite_gap or repeated low-score evidence (≥3 in window).

Strategy selection: `reteach` (misconception), `prerequisite_repair`, `transfer_bridge`, `fluency_drill`, else `practice_gap`.

Each strategy emits 3 actionable steps (explain/practice/transfer/recall/assessment) — measurable intervention, not motivational text.

---

## Mentor — Real Context

```
Context Builder (Student, Goal, Roadmap, Current Unit, ConceptStates,
                Recent Evidence, Misconceptions, Failures, Behavior,
                Adaptive Recommendation, Previous Interactions)
  ↓
Mentor Policy
  ↓
LLM (if GEMINI_API_KEY) else Mock
  ↓
Response Validator (blocks hallucinated mastery/scores, blocks direct goal/roadmap mutation)
  ↓
Mentor Response + suggestions
```

Truth lives in DB/engines; LLM does explanation/dialogue/examples/Socratic questioning only. If no data, answer is “unknown”, not hallucinated.

---

## Event Model

Append-only `LearningEvent`:

```
eventId, studentId, type, timestamp, source, entityType, entityId,
payload, schemaVersion, correlationId, createdAt
```

Types: `SESSION_STARTED, SESSION_ENDED, ASSESSMENT_STARTED, ASSESSMENT_COMPLETED, QUESTION_ANSWERED, GOAL_CREATED, GOAL_LOCKED, ROADMAP_GENERATED, UNIT_STARTED, UNIT_COMPLETED, EVIDENCE_SUBMITTED, EVALUATION_COMPLETED, RECALL_SCHEDULED, RECALL_COMPLED, RECALL_FAILED, TEST_STARTED, TEST_COMPLETED, HINT_REQUESTED, MISSION_SKIPPED, MISSION_ABANDONED, MENTOR_INTERACTION, RECOVERY_STARTED, RECOVERY_COMPLETED` (and their `...` variants). Each event is validated, indexed (`[studentId,type]`, `[studentId,timestamp desc]`, `[correlationId]`), owned, and privacy-bounded.

---

## Transparency

Every adaptive recommendation exposes “Why am I seeing this?” — the reason derived from the diagnosis, not from an LLM guess. The student can see the link: evidence → state → diagnosis → action.

```
Your next task is TRANSFER for Closures
because your knowledge is strong (0.82)
but your transfer evidence is still limited (0.35)
and your last two attempts used hints.
```

If the system cannot answer “What did the student actually learn? What not yet? Why? What’s the best next intervention? Did it work?” from persisted rows, it is not done — no matter how the UI looks.
