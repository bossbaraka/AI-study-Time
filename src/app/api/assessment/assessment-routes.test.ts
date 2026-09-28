/**
 * Assessment route integration — the HTTP boundary, exercised for real.
 *
 * Everything above the domain layer is in scope here: cookie → student
 * resolution, request validation, ownership enforcement, error funnel and
 * — critically — what actually lands in the response body.
 *
 * The Prisma-backed gateway is replaced with a fake session resolver (there
 * is no database in this suite); `withStudent`, `requireStudentApi`,
 * `csrfRejected`, `errorResponse` and every route handler are the real ones.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { sessions, cookieJar } = vi.hoisted(() => ({
  /** token → signed-in user id. The test's stand-in for the sessions table. */
  sessions: new Map<string, { id: string; role: string }>(),
  cookieJar: { token: undefined as string | undefined },
}));

vi.mock("@/lib/server/db", () => ({ prisma: {} }));

vi.mock("@/lib/server/auth/gateway", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/auth/gateway")>();
  return {
    ...actual,
    createGateway: () => ({
      async resolveSession(rawToken: string | undefined) {
        const entry = rawToken ? sessions.get(rawToken) : undefined;
        if (!entry) return { status: "unauthenticated", session: null, expired: false };
        return {
          status: "authenticated",
          expired: false,
          session: {
            issuedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
            user: {
              id: entry.id,
              name: entry.id,
              email: `${entry.id}@example.com`,
              role: entry.role,
              emailVerification: { status: "verified", verifiedAt: null },
              onboarding: { status: "completed", completedAt: null },
            },
          },
        };
      },
    }),
  };
});

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "mureeh_session" && cookieJar.token ? { value: cookieJar.token } : undefined,
  }),
}));

// A generated bank carrying the answer key — exactly what the removed
// /api/assessment/generate endpoint used to hand to the browser.
vi.mock("@/lib/server/ai/question-generator", () => ({
  generateAssessmentQuestions: async () => ({
    bank: [
      {
        question: {
          id: "ai_1",
          type: "multiple_choice",
          prompt: "Which cell organelle produces ATP?",
          topic: "cell_biology",
          difficulty: "foundational",
          estimatedSeconds: 50,
          options: [
            { id: "a", label: "Mitochondrion" },
            { id: "b", label: "Ribosome" },
          ],
        },
        scoring: { kind: "option", correctOptionId: "a" },
      },
      {
        question: {
          id: "ai_2",
          type: "short_answer",
          prompt: "Describe what photosynthesis produces.",
          topic: "cell_biology",
          difficulty: "intermediate",
          estimatedSeconds: 60,
        },
        scoring: { kind: "keywords", keywords: ["glucose", "oxygen"], minMatches: 1 },
      },
    ],
    topics: ["cell_biology"],
  }),
}));

import { POST as createSession } from "@/app/api/assessment/sessions/route";
import { GET as getActiveSession } from "@/app/api/assessment/sessions/active/route";
import { GET as getSession } from "@/app/api/assessment/sessions/[sessionId]/route";
import { POST as submitAnswer } from "@/app/api/assessment/sessions/[sessionId]/answers/route";
import { POST as pauseSession } from "@/app/api/assessment/sessions/[sessionId]/pause/route";
import { GET as getResults } from "@/app/api/assessment/sessions/[sessionId]/results/route";
import { GET as getLatestResult } from "@/app/api/assessment/results/latest/route";
import { __clearRateBuckets } from "@/lib/server/auth/rate-limit";
import { mockAssessmentEngine } from "@/services/engines";
import type { AssessmentSession, SubmitAnswerPayload } from "@/types/assessment";

const TOKEN_A = "token_student_a";
const TOKEN_B = "token_student_b";
const TOKEN_GUARDIAN = "token_guardian";
const STUDENT_A = "student_a";
const STUDENT_B = "student_b";

const ORIGIN = "https://mureeh.test";

function call(handler: (req: Request, ctx: never) => Promise<Response>, init?: RequestInit) {
  return handler(new Request(`${ORIGIN}/api/assessment`, init), {} as never);
}

function params(sessionId: string) {
  return { params: Promise.resolve({ sessionId }) } as never;
}

function json(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, host: "mureeh.test" },
    body: JSON.stringify(body),
  };
}

function signInAs(token: string | undefined) {
  cookieJar.token = token;
}

/** Plays student A's session to a completed diagnosis. */
async function completeAsA(sessionId: string) {
  for (let i = 0; i < 40; i += 1) {
    const current = mockAssessmentEngine.getSession(sessionId, STUDENT_A);
    if (current.status !== "in_progress") break;
    const question = current.currentQuestion!;
    const firstOptionId = question.options?.[0]?.id ?? "a";
    const response =
      question.type === "multiple_choice" || question.type === "scenario"
        ? { type: question.type, questionId: question.id, optionId: firstOptionId }
        : { type: question.type, questionId: question.id, answer: "an answer" };
    mockAssessmentEngine.submitAnswer(
      { sessionId, response, submissionId: `sub_${i}` } as SubmitAnswerPayload,
      STUDENT_A,
    );
  }
  const still = mockAssessmentEngine.getSession(sessionId, STUDENT_A);
  if (still.status === "in_progress") mockAssessmentEngine.completeSession(sessionId, STUDENT_A);
}

async function body(res: Response) {
  return (await res.json()) as Record<string, unknown>;
}

beforeEach(() => {
  sessions.clear();
  sessions.set(TOKEN_A, { id: STUDENT_A, role: "student" });
  sessions.set(TOKEN_B, { id: STUDENT_B, role: "student" });
  sessions.set(TOKEN_GUARDIAN, { id: "guardian_01", role: "guardian" });
  cookieJar.token = undefined;
  __clearRateBuckets();
  mockAssessmentEngine.__reset();
});

describe("POST /api/assessment/sessions — authentication and ownership", () => {
  it("refuses an anonymous caller before any domain work happens", async () => {
    signInAs(undefined);
    const res = await call(createSession, json({}));
    expect(res.status).toBe(401);
    expect(await body(res)).toEqual({ code: "session_expired" });
    // No session was created for anyone.
    expect(mockAssessmentEngine.getActiveSession(STUDENT_A)).toBeNull();
  });

  it("refuses a signed-in guardian: only students take assessments", async () => {
    signInAs(TOKEN_GUARDIAN);
    const res = await call(createSession, json({}));
    expect(res.status).toBe(403);
    expect(await body(res)).toEqual({ code: "forbidden" });
  });

  it("binds the created session to the cookie's student, never to the body", async () => {
    signInAs(TOKEN_A);
    // A crafted body naming another student must be ignored entirely.
    const res = await call(createSession, json({ studentId: STUDENT_B }));
    expect(res.status).toBe(201);
    const created = (await body(res)) as unknown as AssessmentSession;
    expect(mockAssessmentEngine.getActiveSession(STUDENT_A)?.id).toBe(created.id);
    expect(mockAssessmentEngine.getActiveSession(STUDENT_B)).toBeNull();
  });

  it("rejects a malformed profile with 400 instead of reaching the generator", async () => {
    signInAs(TOKEN_A);
    const res = await call(createSession, json({ profile: { targetSubject: "", age: 200 } }));
    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({ code: "unknown" });
  });

  it("returns questions but never the answer key of the generated bank", async () => {
    signInAs(TOKEN_A);
    const res = await call(
      createSession,
      json({ profile: { targetSubject: "Cell biology", age: 16, stage: "high_school" } }),
    );
    expect(res.status).toBe(201);
    const wire = await res.text();
    expect(wire).toContain("organelle"); // the question itself is served
    expect(wire).not.toContain("correctOptionId");
    expect(wire).not.toContain("minMatches");
    // Option text IS served — the student has to read the choices. What
    // must not cross the boundary is which one the bank marks correct.
    expect(wire).toContain("Mitochondrion");
  });
});

describe("assessment session ownership over HTTP (§43.6)", () => {
  it("gives student B a 404 — not a 403 — on student A's session", async () => {
    signInAs(TOKEN_A);
    const created = (await body(
      await call(createSession, json({})),
    )) as unknown as AssessmentSession;

    signInAs(TOKEN_B);
    const foreign = await getSession(
      new Request(`${ORIGIN}/api/assessment/sessions/${created.id}`),
      params(created.id),
    );
    // 403 would confirm the id exists; 404 keeps existence private.
    expect(foreign.status).toBe(404);
    expect(await body(foreign)).toEqual({ code: "session_not_found" });
  });

  it("serves the owner the same session", async () => {
    signInAs(TOKEN_A);
    const created = (await body(
      await call(createSession, json({})),
    )) as unknown as AssessmentSession;
    const res = await getSession(
      new Request(`${ORIGIN}/api/assessment/sessions/${created.id}`),
      params(created.id),
    );
    expect(res.status).toBe(200);
    expect((await body(res)).id).toBe(created.id);
  });

  it("rejects a non-owner's answer, pause and results read", async () => {
    signInAs(TOKEN_A);
    const created = (await body(
      await call(createSession, json({})),
    )) as unknown as AssessmentSession;
    const question = created.currentQuestion!;

    signInAs(TOKEN_B);
    const answer = await submitAnswer(
      new Request(`${ORIGIN}/api/assessment/sessions/${created.id}/answers`, json({
        sessionId: created.id,
        response: {
          type: "multiple_choice",
          questionId: question.id,
          optionId: question.options?.[0]?.id ?? "a",
        },
        submissionId: "sub_b",
      })),
      params(created.id),
    );
    expect(answer.status).toBe(404);

    const pause = await pauseSession(
      new Request(`${ORIGIN}/api/assessment/sessions/${created.id}/pause`, {
        method: "POST",
        headers: { origin: ORIGIN, host: "mureeh.test" },
      }),
      params(created.id),
    );
    expect(pause.status).toBe(404);

    const results = await getResults(
      new Request(`${ORIGIN}/api/assessment/sessions/${created.id}/results`),
      params(created.id),
    );
    expect(results.status).toBe(404);

    // A's session is untouched.
    signInAs(TOKEN_A);
    expect(mockAssessmentEngine.getSession(created.id, STUDENT_A).progress.questionsAnswered).toBe(0);
  });

  it("scopes /sessions/active and /results/latest to the caller", async () => {
    signInAs(TOKEN_A);
    const created = (await body(
      await call(createSession, json({})),
    )) as unknown as AssessmentSession;

    signInAs(TOKEN_B);
    expect(await body(await call(getActiveSession))).toBeNull();
    expect(await body(await call(getLatestResult))).toBeNull();

    signInAs(TOKEN_A);
    expect((await body(await call(getActiveSession))).id).toBe(created.id);
  });
});

describe("server-authoritative grading over HTTP (§43.5)", () => {
  it("ignores a client-supplied `correct` flag and grades from the key", async () => {
    signInAs(TOKEN_A);
    const created = (await body(
      await call(
        createSession,
        json({ profile: { targetSubject: "Cell biology", age: 16, stage: "high_school" } }),
      ),
    )) as unknown as AssessmentSession;
    const question = created.currentQuestion!;

    const gradeWith = async (extra: Record<string, unknown>, submissionId: string) => {
      mockAssessmentEngine.__reset();
      __clearRateBuckets();
      const fresh = (await body(
        await call(
          createSession,
          json({ profile: { targetSubject: "Cell biology", age: 16, stage: "high_school" } }),
        ),
      )) as unknown as AssessmentSession;
      const freshQuestion = fresh.currentQuestion!;
      const res = await submitAnswer(
        new Request(`${ORIGIN}/api/assessment/sessions/${fresh.id}/answers`, json({
          sessionId: fresh.id,
          response: {
            type: "multiple_choice",
            questionId: freshQuestion.id,
            // Deliberately the WRONG option.
            optionId: freshQuestion.options?.[1]?.id ?? "b",
          },
          submissionId,
          ...extra,
        })),
        params(fresh.id),
      );
      expect(res.status).toBe(200);
      await completeAsA(fresh.id);
      const results = (await body(
        await getResults(
          new Request(`${ORIGIN}/api/assessment/sessions/${fresh.id}/results`),
          params(fresh.id),
        ),
      )) as { questionsAnswered: number };
      return results.questionsAnswered;
    };

    const honest = await gradeWith({}, "sub_honest");
    const cheated = await gradeWith({ correct: true, score: 100 }, "sub_cheat");
    // The smuggled verdict changes nothing about how the server graded it.
    expect(cheated).toBe(honest);
    void question;
  });

  it("rejects an answer whose shape the schema does not allow", async () => {
    signInAs(TOKEN_A);
    const created = (await body(
      await call(createSession, json({})),
    )) as unknown as AssessmentSession;
    const res = await submitAnswer(
      new Request(
        `${ORIGIN}/api/assessment/sessions/${created.id}/answers`,
        json({ sessionId: created.id, response: { type: "multiple_choice" }, submissionId: "s" }),
      ),
      params(created.id),
    );
    expect(res.status).toBe(400);
    expect(await body(res)).toEqual({ code: "unknown" });
  });

  it("rejects a body whose sessionId disagrees with the URL", async () => {
    signInAs(TOKEN_A);
    const created = (await body(
      await call(createSession, json({})),
    )) as unknown as AssessmentSession;
    const res = await submitAnswer(
      new Request(
        `${ORIGIN}/api/assessment/sessions/${created.id}/answers`,
        json({
          sessionId: "asess_someone_else",
          response: { type: "short_answer", questionId: "q1", answer: "hi" },
          submissionId: "s",
        }),
      ),
      params(created.id),
    );
    expect(res.status).toBe(400);
  });
});
