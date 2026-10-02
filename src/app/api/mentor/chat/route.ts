import { NextResponse } from "next/server";
import { invalidRequestResponse, withStudent } from "@/lib/server/auth/request";
import { getIntelligenceStores } from "@/services/infrastructure/intelligence-stores";
import { buildMentorContext, validateMentorResponse } from "@/services/mentor/mentor-context-builder";
import { getAdaptiveDecision } from "@/services/application/intelligence-application";
import { getAIProvider } from "@/lib/server/ai/provider";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  content: z.string().min(1).max(2000),
  correlationId: z.string().max(100).optional(),
});

/**
 * POST /api/mentor/chat
 * Body: { content, correlationId? }
 * Returns: { reply: string, context: MentorContext }
 *
 * Flow: Context Builder → Mentor Policy → LLM → Response Validator → Response
 * Truth lives in DB/engines; LLM only verbalizes.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return invalidRequestResponse();

  return withStudent(req, async (student) => {
    const stores = getIntelligenceStores();

    // Build real context
    const [states, evidence, events, adaptive] = await Promise.all([
      stores.conceptStates.listByStudent(student.id),
      stores.evidences.listByStudent(student.id, 10),
      stores.learningEvents.listByStudent(student.id, 50),
      getAdaptiveDecision(student.id).catch(() => null),
    ]);

    let goalTitle: string | null = null;
    let roadmapTitle: string | null = null;
    let currentUnitTitle: string | null = null;
    try {
      const { getPool } = await import("@/services/infrastructure/pg-pool");
      const pool = getPool();
      const g = await pool.query(`SELECT "desiredOutcome" FROM "Goal" WHERE "studentId"=$1 ORDER BY "updatedAt" DESC LIMIT 1`, [student.id]);
      if (g.rows[0]) goalTitle = g.rows[0].desiredOutcome as string;
      const r = await pool.query(`SELECT "title" FROM "Roadmap" WHERE "studentId"=$1 AND "status"='active' LIMIT 1`, [student.id]);
      if (r.rows[0]) roadmapTitle = r.rows[0].title as string;
    } catch { /* ignore */ }

    const context = buildMentorContext({
      studentId: student.id,
      goalTitle,
      roadmapTitle,
      currentUnitTitle,
      conceptStates: states,
      recentEvidence: evidence,
      recentEvents: events,
      adaptiveDecision: adaptive,
    });

    // Append user message as event
    await stores.learningEvents.append({
      studentId: student.id,
      type: "MENTOR_INTERACTION",
      source: "api",
      entityType: "MentorMessage",
      entityId: `msg_${Date.now()}`,
      payload: { role: "student", content: parsed.data.content, correlationId: parsed.data.correlationId },
      correlationId: parsed.data.correlationId,
    }).catch(() => {});

    // Construct prompt with real context (no secrets, no raw tokens)
    const system = `You are Mureeh, a supportive learning mentor. You must:
- Ground every answer in the provided learner context. If context is unknown, say "unknown" — never hallucinate.
- Never claim to change goals, roadmaps, or mastery directly.
- Never invent progress, scores, or history not present in context.
- Explain, give examples, ask Socratic questions, and rephrase — do not decide mastery or verdicts.
- Be concise, warm, and actionable. Use the "Why this next step" from adaptiveRecommendation when relevant.

Context JSON: ${JSON.stringify({ goalTitle: context.goalTitle, roadmapTitle: context.roadmapTitle, weakConcepts: context.weakConcepts, strongConcepts: context.strongConcepts, recentFailures: context.recentFailures, behavior: context.behavior, adaptiveRecommendation: context.adaptiveRecommendation?.primary ?? null })}`;

    let reply: string;
    try {
      const provider = getAIProvider();
      reply = await provider.generateText({ prompt: parsed.data.content, system });
    } catch {
      // Fallback deterministic mentor (no network)
      const provider = new (await import("@/lib/server/ai/provider")).AIMockProvider();
      reply = await provider.generateText({ prompt: parsed.data.content, system });
    }

    // Validate
    const check = validateMentorResponse(context, reply);
    if (!check.allowed) {
      reply = `I don't have enough evidence to answer that specifically yet. Here's what I do know: your recent work ${context.recentEvidence.length ? `includes ${context.recentEvidence.length} pieces of evidence` : "has no graded evidence yet"}. Ask me about a specific concept you're practicing and I'll give a targeted explanation.`;
    }

    // Append assistant event
    await stores.learningEvents.append({
      studentId: student.id,
      type: "MENTOR_INTERACTION",
      source: "engine",
      entityType: "MentorMessage",
      entityId: `msg_${Date.now() + 1}`,
      payload: { role: "mentor", content: reply, correlationId: parsed.data.correlationId },
      correlationId: parsed.data.correlationId,
    }).catch(() => {});

    return NextResponse.json({ reply, context, suggestions: ["Give me an example", "Test me", "What should I do now?"] });
  });
}
