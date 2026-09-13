/**
 * Intelligence & support domain services:
 * behavior profile, recovery plans, AI mentor.
 */

import { clone, mockRequest } from "@/lib/api/client";
import { db } from "@/services/mock-db";
import type {
  BehaviorProfile,
  MentorContext,
  MentorMessage,
  RecoveryPlan,
} from "@/types/domain";
import type { RecoveryStep } from "@/constants/journey";

export const behaviorService = {
  getProfile(signal?: AbortSignal): Promise<BehaviorProfile> {
    return mockRequest(() => clone(db.behavior), signal);
  },
};

export const recoveryService = {
  getActive(signal?: AbortSignal): Promise<RecoveryPlan | null> {
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
 * Mentor service. The mock generates contextual replies locally;
 * the real implementation streams from the AI service with the same
 * journey context attached server-side.
 */
export const mentorService = {
  getContext(signal?: AbortSignal): Promise<MentorContext> {
    return mockRequest(() => clone(db.mentorContext), signal);
  },

  listMessages(signal?: AbortSignal): Promise<MentorMessage[]> {
    return mockRequest(() => clone(db.mentorMessages), signal);
  },

  send(content: string, signal?: AbortSignal): Promise<MentorMessage[]> {
    return mockRequest(async () => {
      const now = new Date().toISOString();
      const studentMessage: MentorMessage = {
        id: `mm_s_${Date.now()}`,
        role: "student",
        content,
        createdAt: now,
      };
      db.mentorMessages = [...db.mentorMessages, studentMessage];

      // Simulate the AI service thinking.
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
  },
};

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
