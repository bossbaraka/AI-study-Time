/**
 * Browser-service → HTTP → real route → real PostgreSQL smoke integration.
 *
 * The unit route suites above call handlers directly. This one also exercises
 * the production client transport: outside Vitest mode the feature services
 * must call `fetch`, not their in-process engines. `fetch` is intercepted only
 * to dispatch to the actual Next route function in-process; the auth wrapper,
 * application/domain code and PostgreSQL are all real.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/auth/gateway", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { createGatewayModule } = await import("@/test/route-harness");
  return createGatewayModule(actual);
});

vi.mock("next/headers", async () => {
  const { createHeadersModule } = await import("@/test/route-harness");
  return createHeadersModule();
});

import { prisma } from "@/lib/server/db";
import { ctx, seedUsers, sessions, signInAs, ORIGIN } from "@/test/route-harness";
import type { GoalDiscoveryInput } from "@/types/goal";

const TOKEN = "token_runtime_flow";
const STUDENT = "student_runtime_flow";

function input(): GoalDiscoveryInput {
  return {
    targetDomain: { kind: "preset", presetId: "javascript" },
    desiredOutcome: "Build and deploy two practical JavaScript apps with tests and clean code",
    motivation: { kind: "career" },
    currentLevel: "developing",
    targetLevel: "build_independently",
    timeframe: { weeks: 24, preset: true },
    weeklyCommitment: { hoursPerWeek: 7, preset: true },
    constraints: [],
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(async () => {
  // Production transport is selected by the same runtime predicate used in
  // `assessment.service.ts` and `auth.service.ts`: VITEST is absent.
  vi.stubEnv("VITEST", "");
  vi.stubEnv("NEXT_PUBLIC_DEMO_DATA", "false");
  await prisma.user.deleteMany({ where: { id: STUDENT } });
  await seedUsers(STUDENT);
  sessions.clear();
  sessions.set(TOKEN, { id: STUDENT, role: "student" });
  signInAs(TOKEN);

  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), ORIGIN);
    const req = new Request(url, init);

    if (url.pathname === "/api/auth/session" && req.method === "GET") {
      const route = await import("@/app/api/auth/session/route");
      return route.GET(req);
    }
    if (url.pathname === "/api/goals/active" && req.method === "GET") {
      const route = await import("@/app/api/goals/active/route");
      return route.GET(req);
    }
    if (url.pathname === "/api/goals" && req.method === "POST") {
      const route = await import("@/app/api/goals/route");
      return route.POST(req);
    }
    const goalMatch = /^\/api\/goals\/([^/]+)$/.exec(url.pathname);
    if (goalMatch && req.method === "GET") {
      const route = await import("@/app/api/goals/[goalId]/route");
      return route.GET(req, ctx("goalId", decodeURIComponent(goalMatch[1]!)));
    }
    const lockMatch = /^\/api\/goals\/([^/]+)\/lock$/.exec(url.pathname);
    if (lockMatch && req.method === "POST") {
      const route = await import("@/app/api/goals/[goalId]/lock/route");
      return route.POST(req, ctx("goalId", decodeURIComponent(lockMatch[1]!)));
    }
    if (url.pathname === "/api/roadmaps/generate" && req.method === "POST") {
      const route = await import("@/app/api/roadmaps/generate/route");
      return route.POST(req);
    }
    if (url.pathname === "/api/roadmaps/active" && req.method === "GET") {
      const route = await import("@/app/api/roadmaps/active/route");
      return route.GET(req);
    }
    if (url.pathname === "/api/executions/view" && req.method === "GET") {
      const route = await import("@/app/api/executions/view/route");
      return route.GET(req);
    }
    const unitMatch = /^\/api\/executions\/units\/([^/]+)\/(context|start|evidence|evaluate)$/.exec(url.pathname);
    if (unitMatch) {
      const unitId = decodeURIComponent(unitMatch[1]!);
      const routeCtx = ctx("learningUnitId", unitId);
      if (unitMatch[2] === "context" && req.method === "GET") {
        const route = await import("@/app/api/executions/units/[learningUnitId]/context/route");
        return route.GET(req, routeCtx);
      }
      if (unitMatch[2] === "start" && req.method === "POST") {
        const route = await import("@/app/api/executions/units/[learningUnitId]/start/route");
        return route.POST(req, routeCtx);
      }
      if (unitMatch[2] === "evidence" && req.method === "POST") {
        const route = await import("@/app/api/executions/units/[learningUnitId]/evidence/route");
        return route.POST(req, routeCtx);
      }
      if (unitMatch[2] === "evaluate" && req.method === "POST") {
        const route = await import("@/app/api/executions/units/[learningUnitId]/evaluate/route");
        return route.POST(req, routeCtx);
      }
    }
    return Response.json({ code: "not_found" }, { status: 404 });
  }));
});

describe("production service transport crosses the real HTTP and PostgreSQL boundary", () => {
  it("creates, locks, plans and executes using service → fetch → route → database", async () => {
    const { goalDiscoveryService } = await import("@/services/goal-discovery.service");
    const { goalService } = await import("@/services/journey.service");
    const { roadmapService } = await import("@/services/roadmap.service");
    const { executionService } = await import("@/services/execution.service");

    const calls: string[] = [];
    const realFetch = globalThis.fetch;
    const observedFetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${String(input)}`);
      return realFetch(input, init);
    });
    vi.stubGlobal("fetch", observedFetch);

    const initialGoal = await goalDiscoveryService.getActiveGoal();
    expect(initialGoal).toBeNull();
    // No locked goal means no dashboard goal; the production path must not
    // substitute the seeded `mock-db` goal.
    await expect(goalService.getCurrent()).rejects.toMatchObject({
      status: 404,
      code: "goal_not_found",
    });

    const { goal } = await goalDiscoveryService.createGoal(input(), "runtime-flow-create");
    expect(goal.studentId).toBe(STUDENT);
    expect((await prisma.goal.findUnique({ where: { id: goal.id } }))?.studentId).toBe(STUDENT);

    const locked = await goalDiscoveryService.lockGoal(goal.id, "runtime-flow-lock");
    expect(locked.status).toBe("locked");
    const dashboardGoal = await goalService.getCurrent();
    expect(dashboardGoal.id).toBe(goal.id);
    expect(dashboardGoal.locked).toBe(true);

    const { roadmap, created } = await roadmapService.generateRoadmap(goal.id);
    expect(created).toBe(true);
    expect((await prisma.roadmap.findUnique({ where: { id: roadmap.id } }))?.studentId).toBe(STUDENT);

    const active = await roadmapService.getActiveRoadmap();
    expect(active?.id).toBe(roadmap.id);

    const view = await executionService.getExecutionView();
    const unitId = view?.currentUnit?.id;
    expect(unitId).toBeTruthy();
    const context = await executionService.getUnitContext(unitId!);
    expect(context.roadmap.id).toBe(roadmap.id);

    const started = await executionService.startLearningUnit(unitId!);
    expect(started.status).toBe("in_progress");
    expect(await prisma.learningUnitExecution.count({ where: { studentId: STUDENT, roadmapId: roadmap.id } })).toBe(1);

    // Each service crossed fetch; none selected its in-process mock engine.
    expect(calls.some((call) => call.includes("/api/goals"))).toBe(true);
    expect(calls.some((call) => call.includes("/api/roadmaps"))).toBe(true);
    expect(calls.some((call) => call.includes("/api/executions"))).toBe(true);
    expect(observedFetch).toHaveBeenCalled();
  });
});
