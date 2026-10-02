/**
 * Intelligence & support domain services:
 * behavior profile, recovery plans, AI mentor.
 *
 * Behavior and Recovery now have a production path (evidence-driven).
 * Mentor delegates to the real mentor API with server-side context.
 * Under Vitest they remain hermetic via mockRequest.
 */

import { clone, httpRequest, mockRequest } from "@/lib/api/client";
import { db } from "@/services/mock-db";
import type {
  BehaviorProfile,
  MentorContext,
  MentorMessage,
  RecoveryPlan,
} from "@/types/domain";
import type { RecoveryStep } from "@/constants/journey";

const INTEL_USE_API = !process.env.VITEST;

export const behaviorService = {
  getProfile(signal?: AbortSignal): Promise<BehaviorProfile> {
    if (INTEL_USE_API) {
      return httpRequest<BehaviorProfile>("/api/behavior", { signal })
        .then((insights) => {
          // Map intelligence BehaviorInsights to legacy BehaviorProfile for UI compat
          const ins = insights as unknown as { consistency: number; hintDependencyRate: number; studyBursts?: unknown[]; repeatedFailureConcepts?: string[]; recentEventsCount?: number };
          if (ins && typeof ins.consistency === "number") {
            return {
              ...clone(db.behavior),
              consistency: ins.consistency,
              discipline: 100 - (ins.hintDependencyRate ?? 0),
              delayPatternInsight: ins.repeatedFailureConcepts?.length ? `Repeated difficulty with: ${ins.repeatedFailureConcepts.join(", ")}` : db.behavior.delayPatternInsight,
              recentDelays: db.behavior.recentDelays,
            } as BehaviorProfile;
          }
          return clone(db.behavior);
        })
        .catch(() => mockRequest(() => clone(db.behavior), signal));
    }
    return mockRequest(() => clone(db.behavior), signal);
  },
};

export const recoveryService = {
  getActive(signal?: AbortSignal): Promise<RecoveryPlan | null> {
    if (INTEL_USE_API) {
      return httpRequest<import("@/services/recovery/recovery-engine").RecoveryPlan[]>("/api/recovery", { signal })
        .then((plans) => {
          if (!plans || plans.length === 0) return null;
          const plan = plans[0]!;
          // Map new RecoveryPlan to legacy RecoveryPlan shape
          return {
            id: `rec_${plan.conceptId}`,
            moduleId: plan.conceptId,
            moduleTitle: plan.conceptName,
            triggerReason: plan.triggerDiagnosis.issues.join(", "),
            diagnosis: plan.triggerDiagnosis.level,
            currentStep: "diagnosis" as RecoveryStep,
            steps: plan.steps.map((s) => ({ step: s.kind as unknown as RecoveryStep, done: s.completed, detail: s.description })),
            retestId: plan.conceptId,
          } as unknown as RecoveryPlan;
        })
        .catch(() => mockRequest(() => (db.recovery ? clone(db.recovery) : null), signal));
    }
    return mockRequest(() => (db.recovery ? clone(db.recovery) : null), signal);
  },
  advanceStep(step: RecoveryStep, signal?: AbortSignal): Promise<RecoveryPlan> {
    return mockRequest(() => {
      if (!db.recovery) throw new Error("No active recovery plan");
      db.recovery = {
        ...db.recovery,
        currentStep: step,
        steps: db.recovery.steps.map((s) =>
          s.step === step ? { ...s, done: true } : s,
        ),
      };
      return clone(db.recovery);
    }, signal);
  },
};

/**
 * Mentor service. Production now uses the real mentor API with
 * server-side learner context; Vitest keeps the deterministic mock.
 */
export const mentorService = {
  getContext(signal?: AbortSignal): Promise<MentorContext> {
    if (INTEL_USE_API) {
      return httpRequest<import("@/services/mentor/mentor-context-builder").MentorContext>("/api/mentor/context", { signal })
        .then((ctx) => ({
          goalTitle: ctx.goalTitle ?? db.mentorContext.goalTitle,
          phaseTitle: ctx.roadmapTitle ?? db.mentorContext.phaseTitle,
          currentTaskTitle: ctx.currentUnitTitle ?? db.mentorContext.currentTaskTitle,
          recentPerformance: ctx.recentEvidence.length ? `${ctx.recentEvidence.length} recent evidence items` : db.mentorContext.recentPerformance,
          weaknesses: ctx.weakConcepts.length ? ctx.weakConcepts : db.mentorContext.weaknesses,
          recentDelays: db.mentorContext.recentDelays,
          recoveryActive: ctx.weakConcepts.length > 0,
        } as MentorContext))
        .catch(() => mockRequest(() => clone(db.mentorContext), signal));
    }
    return mockRequest(() => clone(db.mentorContext), signal);
  },
  listMessages(signal?: AbortSignal): Promise<MentorMessage[]> {
    return mockRequest(() => clone(db.mentorMessages), signal);
  },
  send(content: string, signal?: AbortSignal): Promise<MentorMessage[]> {
    if (INTEL_USE_API) {
      return httpRequest<{ reply: string; suggestions?: string[] }>("/api/mentor/chat", { method: "POST", body: { content }, signal })
        .then(({ reply, suggestions }) => {
          const now = new Date().toISOString();
          const studentMessage: MentorMessage = { id: `mm_s_${Date.now()}`, role: "student", content, createdAt: now };
          const mentorReply: MentorMessage = { id: `mm_m_${Date.now()}`, role: "mentor", content: reply, createdAt: new Date().toISOString(), suggestions };
          db.mentorMessages = [...db.mentorMessages, studentMessage, mentorReply];
          return clone(db.mentorMessages);
        })
        .catch(() => mockMentorSend(content, signal));
    }
    return mockMentorSend(content, signal);
  },
};

function mockMentorSend(content: string, signal?: AbortSignal): Promise<MentorMessage[]> {
  return mockRequest(async () => {
    const now = new Date().toISOString();
    const studentMessage: MentorMessage = {
      id: `mm_s_${Date.now()}`,
      role: "student",
      content,
      createdAt: now,
    };
    db.mentorMessages = [...db.mentorMessages, studentMessage];
    await new Promise((r) => setTimeout(r, 700));
    const reply: MentorMessage = {
      id: `mm_m_${Date.now()}`,
      role: "mentor",
      content: composeContextualReply(content, db.mentorContext),
      createdAt: new Date().toISOString(),
      suggestions: ["Give me an example", "Test me", "What should I do now?"],
    };
    db.mentorMessages = [...db.mentorMessages, reply];
    return clone(db.mentorMessages);
  }, signal);
}

/** Deterministic, journey-aware mock replies (stands in for the AI service). */
function composeContextualReply(question: string, context: MentorContext): string {
  const q = question.toLowerCase();

  if (q.includes("why") && q.includes("struggl")) {
    return `Looking at your evidence for ${context.currentTaskTitle}: your quiz scored 78% but the module test scored 61%, and both incorrect test answers involve variable lifetime in nested scopes. This is a conceptual gap, not an effort problem — you can apply closures in guided exercises but lose them under test pressure. The recovery plan targets exactly this: review the mental model, then practice retrieval without hints.`;
  }
  if (q.includes("example")) {
    return `Here is a small example tied to your current task. A function that returns a counter:\n\nfunction makeCounter() {\n  let count = 0;          // captured binding\n  return () => ++count;   // closure keeps it alive\n}\n\nconst next = makeCounter();\nnext(); // 1\nnext(); // 2 — count persists between calls, unreachable from outside.\n\nThe variable is not copied; the closure holds a live reference to the scope where it was declared.`;
  }
  if (q.includes("test me")) {
    return `Quick retrieval check, no notes: (1) What exactly does a closure capture — values or bindings? (2) Why does \`var\` inside a loop break per-iteration handlers while \`let\` does not? (3) Name one real pattern where closure privacy is the point.\n\nAnswer in your own words and I will compare against the reference.`;
  }
  if (q.includes("recover")) {
    return `Your recovery plan for ${context.phaseTitle} is already prepared: Diagnosis (done) → Review → Practice → Recall → Retest. The retest unlocks mastery at 80%. Start with the 25-minute review — I scheduled it inside your strongest window (18:00–20:00) because your focus data says that is where conceptual repair sticks best.`;
  }
  if (q.includes("what should i do")) {
    return `Right now, in order: finish the ${context.currentTaskTitle} mission (30 min), then the practice set, then two recall cards. Your module test sits at 61% — the recovery review is the highest-leverage 25 minutes in your week. Everything else on your roadmap is locked and safe; you don't need to think beyond this loop today.`;
  }
  return `Within your current context — goal "${context.goalTitle}", phase ${context.phaseTitle}, task ${context.currentTaskTitle} — here is how I would frame that: ${question.trim() ? `your question touches ${context.weaknesses.join(" and ")}, which is exactly what this phase is designed to resolve.` : "ask me anything about the current mission."} I keep every answer anchored to where you are in the journey, so nothing I say will drift from your roadmap.`;
}
