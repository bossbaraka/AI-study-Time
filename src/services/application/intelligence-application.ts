/**
 * Intelligence Application — server-side coordinator for the
 * Learning Intelligence loop.
 *
 * Called after any evidence is created (execution, assessment,
 * test, recall) to keep ConceptState, Diagnosis and Recall in
 * sync. Also serves read models for mastery, diagnosis, adaptive
 * and behavior.
 *
 * Storage: intelligence stores (concepts, evidences, states,
 * events, recall, tests) via the intelligence composition.
 *
 * **Server-only** — imports pg-backed stores, never mock.
 */

import { getIntelligenceStores } from "@/services/infrastructure/intelligence-stores";
import { conceptIdForCapability, conceptIdForTopic } from "@/services/concept/concept-catalog";
import { masteryEngine } from "@/services/mastery/mastery-engine";
import { diagnosisEngine } from "@/services/diagnosis/diagnosis-engine";
import { adaptiveEngine } from "@/services/adaptive/adaptive-engine";
import { recallEngine } from "@/services/recall/recall-engine";
import { behaviorEngine } from "@/services/behavior/behavior-engine";
import { recoveryEngine } from "@/services/recovery/recovery-engine";
import type { Evidence } from "@/types/evidence";
import type { ConceptState } from "@/types/concept-state";
import type { AdaptiveDecision } from "@/types/adaptive";

function nowIso(): string { return new Date().toISOString(); }

/**
 * Record evidence that came from a LearningUnitExecution evaluation.
 * This is the glue between execution and intelligence: it creates a
 * generic Evidence row, updates ConceptState via MasteryEngine, emits
 * a LearningEvent, and (re)schedules recall.
 */
export async function recordExecutionEvidence(params: {
  studentId: string;
  roadmapId: string;
  learningUnitId: string;
  milestoneCapabilityId: string;
  score: number | null; // 0..1 from developmentEvaluator result
  assessmentSessionId?: string | null;
  solution: string;
  reasoning: string;
  timeSpentSeconds?: number | null;
  hintUsed?: boolean;
  correlationId?: string;
}): Promise<{ evidence: Evidence; state: ConceptState | null }> {
  const stores = getIntelligenceStores();
  const conceptId = conceptIdForCapability(params.milestoneCapabilityId);
  // Even without a concept mapping we still record evidence (for audit), but state update is skipped
  const evidence = await stores.evidences.create(params.studentId, {
    conceptId: conceptId ?? null,
    kind: "solution",
    payload: { solution: params.solution, reasoning: params.reasoning, learningUnitId: params.learningUnitId },
    score: params.score ?? null,
    timeSpentSeconds: params.timeSpentSeconds ?? null,
    attemptCount: 1,
    hintUsed: params.hintUsed ?? false,
    hintCount: params.hintUsed ? 1 : 0,
    learningUnitId: params.learningUnitId,
    roadmapId: params.roadmapId,
    assessmentSessionId: params.assessmentSessionId ?? null,
  });

  await stores.learningEvents.append({
    studentId: params.studentId,
    type: "EVIDENCE_SUBMITTED",
    source: "engine",
    entityType: "Evidence",
    entityId: evidence.id,
    payload: { evidenceId: evidence.id, conceptId, score: evidence.score, learningUnitId: params.learningUnitId },
    correlationId: params.correlationId,
  }).catch(() => {});

  await stores.learningEvents.append({
    studentId: params.studentId,
    type: "EVALUATION_COMPLETED",
    source: "engine",
    entityType: "LearningUnitExecution",
    entityId: params.learningUnitId,
    payload: { learningUnitId: params.learningUnitId, conceptId, score: evidence.score },
    correlationId: params.correlationId,
  }).catch(() => {});

  let nextState: ConceptState | null = null;
  if (conceptId) {
    const prev = await stores.conceptStates.get(params.studentId, conceptId);
    const { next } = masteryEngine.apply(evidence, prev ?? null);
    // pg store expects an id field; memory store ignores it
    const withId = { ...next, id: (prev as unknown as { id?: string })?.id ?? `cs_${params.studentId}_${conceptId}` } as unknown as ConceptState;
    await stores.conceptStates.upsert(withId as ConceptState & { id: string });
    nextState = next;

    // Recall scheduling: evidence-driven
    // Initial schedule after first evidence, then updated on each review elsewhere
    const existingRecall = await stores.recallSchedules.get(params.studentId, conceptId);
    if (!existingRecall) {
      const schedule = recallEngine.scheduleNew(params.studentId, conceptId, evidence.id);
      await stores.recallSchedules.upsert(schedule);
      await stores.learningEvents.append({
        studentId: params.studentId,
        type: "RECALL_SCHEDULED",
        source: "engine",
        entityType: "RecallSchedule",
        entityId: schedule.id,
        payload: { conceptId, dueAt: schedule.dueAt },
        correlationId: params.correlationId,
      }).catch(() => {});
    }
  }

  return { evidence, state: nextState };
}

/**
 * Record assessment evidence (per answer). Called from assessment engine
 * after each QUESTION_ANSWERED or after completion.
 */
export async function recordAssessmentEvidence(params: {
  studentId: string;
  sessionId: string;
  topic: string;
  questionId: string;
  score: number; // 0, 0.5, 1
  timeSpentSeconds?: number | null;
  correlationId?: string;
}): Promise<void> {
  const stores = getIntelligenceStores();
  const conceptId = conceptIdForTopic(params.topic);
  if (!conceptId) return;

  const evidence = await stores.evidences.create(params.studentId, {
    conceptId,
    kind: "answer",
    payload: { questionId: params.questionId, topic: params.topic, score: params.score },
    score: params.score,
    timeSpentSeconds: params.timeSpentSeconds ?? null,
    assessmentSessionId: params.sessionId,
  });

  await stores.learningEvents.append({
    studentId: params.studentId,
    type: "QUESTION_ANSWERED",
    source: "engine",
    entityType: "AssessmentAnswer",
    entityId: params.questionId,
    payload: { questionId: params.questionId, conceptId, score: params.score },
    correlationId: params.correlationId,
  }).catch(() => {});

  const prev = await stores.conceptStates.get(params.studentId, conceptId);
  const { next } = masteryEngine.apply(evidence, prev ?? null);
  const withId = { ...next, id: (prev as unknown as { id?: string })?.id ?? `cs_${params.studentId}_${conceptId}` } as unknown as ConceptState;
  await stores.conceptStates.upsert(withId as ConceptState & { id: string });
}

// ------------------------------------------------------------------
// Read models
// ------------------------------------------------------------------

export async function getConceptStates(studentId: string): Promise<ConceptState[]> {
  const stores = getIntelligenceStores();
  return stores.conceptStates.listByStudent(studentId);
}

export async function getMasteryView(studentId: string) {
  const stores = getIntelligenceStores();
  const states = await stores.conceptStates.listByStudent(studentId);
  const concepts = await stores.concepts.list();
  const map = new Map(concepts.map((c) => [c.id, c]));

  // Build mastery per concept — honest, evidence-backed
  return states.map((s) => {
    const concept = map.get(s.conceptId);
    const diagnosis = diagnosisEngine.diagnose(s, concept ?? null);
    return {
      conceptId: s.conceptId,
      conceptName: concept?.name ?? s.conceptId,
      domain: concept?.domain ?? "unknown",
      state: s,
      diagnosis,
      // UI-friendly derived flag: achieved when knowledge+retrieval+transfer all >= 0.7 and no high-risk flags
      achieved: s.knowledge >= 0.7 && s.retrieval >= 0.6 && s.transfer >= 0.5 && s.misconceptionRisk < 0.5 && s.hintDependency < 0.5,
    };
  }).sort((a, b) => a.conceptName.localeCompare(b.conceptName));
}

export async function getDiagnoses(studentId: string) {
  const stores = getIntelligenceStores();
  const states = await stores.conceptStates.listByStudent(studentId);
  const concepts = await stores.concepts.list();
  const conceptById = new Map(concepts.map((c) => [c.id, c]));
  // For prerequisite checks, we need each concept's prerequisites' states
  const stateById = new Map(states.map((s) => [s.conceptId, s]));
  return states.map((s) => {
    const concept = conceptById.get(s.conceptId) ?? null;
    const prereqStates = concept ? concept.prerequisites.map((pid) => stateById.get(pid) ?? null) : [];
    return diagnosisEngine.diagnose(s, concept, prereqStates);
  });
}

export async function getAdaptiveDecision(studentId: string, opts?: { goalId?: string | null; roadmapId?: string | null; currentUnitId?: string | null }): Promise<AdaptiveDecision> {
  const stores = getIntelligenceStores();
  const states = await stores.conceptStates.listByStudent(studentId);
  const diagnosesRaw = await getDiagnoses(studentId);
  const diagnoses = diagnosesRaw.map((d) => diagnosisEngine.toInput(d));
  const recentEvidence = await stores.evidences.listByStudent(studentId, 20);
  const recentEvents = await stores.learningEvents.listByStudent(studentId, 50);
  const hasActiveRecovery = diagnosesRaw.some((d) => d.issues.includes("misconception") || d.issues.includes("weakness"));

  return adaptiveEngine.decide({
    studentId,
    goalId: opts?.goalId ?? null,
    roadmapId: opts?.roadmapId ?? null,
    currentUnitId: opts?.currentUnitId ?? null,
    conceptStates: states,
    diagnoses,
    recentEvidenceCount: recentEvidence.length,
    hasActiveRecovery,
    streakDays: new Set(recentEvents.map((e) => new Date(e.timestamp).toISOString().slice(0, 10))).size,
  });
}

export async function getBehaviorInsights(studentId: string) {
  const stores = getIntelligenceStores();
  const events = await stores.learningEvents.listByStudent(studentId, 200);
  return behaviorEngine.analyze(events);
}

export async function getRecallDue(studentId: string) {
  const stores = getIntelligenceStores();
  const due = await stores.recallSchedules.listDue(studentId);
  const concepts = await stores.concepts.list();
  const byId = new Map(concepts.map((c) => [c.id, c]));
  return due.map((s) => ({ schedule: s, concept: byId.get(s.conceptId) ?? null }));
}

export async function reviewRecall(studentId: string, conceptId: string, quality: number) {
  const stores = getIntelligenceStores();
  const schedule = await stores.recallSchedules.get(studentId, conceptId);
  if (!schedule) throw new Error("schedule_not_found");
  const next = recallEngine.review(schedule, { conceptId, quality });
  await stores.recallSchedules.upsert(next);
  // Also record recall evidence and update state
  const wasCorrect = quality >= 3;
  const score = wasCorrect ? (quality === 5 ? 1 : quality === 4 ? 0.9 : 0.7) : (quality === 2 ? 0.4 : quality === 1 ? 0.2 : 0);
  const evidence = await stores.evidences.create(studentId, {
    conceptId,
    kind: "recall_result",
    payload: { quality, wasCorrect, conceptId },
    score,
  });
  const prev = await stores.conceptStates.get(studentId, conceptId);
  if (prev) {
    const { next: stateNext } = masteryEngine.apply(evidence, prev);
    const withId = { ...stateNext, id: (prev as unknown as { id?: string })?.id ?? `cs_${studentId}_${conceptId}` } as unknown as ConceptState;
    await stores.conceptStates.upsert(withId as ConceptState & { id: string });
  }
  await stores.learningEvents.append({
    studentId,
    type: wasCorrect ? "RECALL_COMPLETED" : "RECALL_FAILED",
    source: "api",
    entityType: "RecallSchedule",
    entityId: schedule.id,
    payload: { conceptId, quality, wasCorrect, nextDueAt: next.dueAt },
  }).catch(() => {});

  return { schedule: next, evidence };
}

export async function getRecoveryPlans(studentId: string) {
  const diagnoses = await getDiagnoses(studentId);
  const states = await getConceptStates(studentId);
  const stateById = new Map(states.map((s) => [s.conceptId, s]));
  const plans = diagnoses
    .map((d) => {
      const state = stateById.get(d.conceptId) ?? null;
      return recoveryEngine.plan(d, state);
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
  return plans;
}
