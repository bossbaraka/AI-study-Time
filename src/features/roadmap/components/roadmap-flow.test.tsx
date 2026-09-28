/**
 * /roadmap UI (§21–§24, §34.F): routing contract, generation screen,
 * roadmap view with one current milestone, loading/error/retry, refresh
 * persistence, Arabic + RTL, accessible timeline semantics.
 * Runs against the REAL goal + roadmap engines.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { RoadmapFlow } from "@/features/roadmap/components/roadmap-flow";
import { I18nProvider } from "@/lib/i18n/provider";
import { authService } from "@/services/auth.service";
import { mockExecutionEngine } from "@/services/engines";
import { mockGoalEngine } from "@/services/engines";
import { RoadmapApiError } from "@/services/roadmap.service";
import { mockRoadmapEngine } from "@/services/engines";
import type { GoalDiscoveryInput } from "@/types/goal";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
}));

vi.mock("framer-motion", async () => {
  const react = await import("react");
  const strip = (props: Record<string, unknown>) => {
    const { initial, animate, exit, transition, variants, ...rest } = props;
    void initial;
    void animate;
    void exit;
    void transition;
    void variants;
    return rest;
  };
  return {
    motion: {
      div: (props: Record<string, unknown>) => react.createElement("div", strip(props)),
    },
    AnimatePresence: ({ children }: { children: ReactNode }) =>
      react.createElement(react.Fragment, null, children),
  };
});

const PASSWORD = "securePass1";
const STUDENT_EMAIL = "layla.hassan@example.com";
const OUTCOME = "Build and deploy two practical JavaScript apps with tests and clean code";

function jsInput(overrides: Partial<GoalDiscoveryInput> = {}): GoalDiscoveryInput {
  return {
    targetDomain: { kind: "preset", presetId: "javascript" },
    desiredOutcome: OUTCOME,
    motivation: { kind: "career" },
    currentLevel: "developing",
    targetLevel: "build_independently",
    timeframe: { weeks: 24, preset: true },
    weeklyCommitment: { hoursPerWeek: 7, preset: true },
    constraints: [],
    ...overrides,
  };
}

let studentId = "";

function renderFlow() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(I18nProvider, null, children),
    );
  return render(<RoadmapFlow />, { wrapper });
}

async function lockGoal(input: GoalDiscoveryInput = jsInput()): Promise<string> {
  const created = await mockGoalEngine.createGoal(input, {
    studentId,
    idempotencyKey: `seed-${Math.random()}`,
    diagnosisContext: null,
  });
  const locked = await mockGoalEngine.lockGoal(created.goal.id, studentId, `seed-lock-${Math.random()}`);
  return locked.id;
}

beforeEach(async () => {
  window.localStorage.removeItem("mureeh.locale");
  vi.clearAllMocks();
  await mockExecutionEngine.__reset();
  await mockRoadmapEngine.__reset();
  await mockGoalEngine.__reset();
  const { session } = await authService.login({ email: STUDENT_EMAIL, password: PASSWORD });
  studentId = session.user.id;
});

describe("/roadmap — routing contract (§21)", () => {
  it("redirects to /goals when no goal exists", async () => {
    renderFlow();
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/goals"));
  });

  it("redirects to /goals when the goal is not locked", async () => {
    await mockGoalEngine.createGoal(
      jsInput({ desiredOutcome: "I want to learn more about JavaScript overall" }),
      { studentId, idempotencyKey: "seed-unlocked", diagnosisContext: null },
    );
    renderFlow();
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/goals"));
  });

  it("never generates a roadmap without a locked goal", async () => {
    renderFlow();
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/goals"));
    expect(await mockRoadmapEngine.getActiveRoadmap(studentId)).toBeNull();
  });
});

describe("/roadmap — generation screen (§19/§22)", () => {
  it("shows the locked goal and one explicit generate action", async () => {
    await lockGoal();
    renderFlow();
    expect(
      await screen.findByRole("heading", { name: /Your goal is locked\. Now let's build the path\./i }),
    ).toBeDefined();
    // The goal the path serves is restated.
    expect(screen.getByText(OUTCOME)).toBeDefined();
    expect(screen.getByRole("button", { name: /Generate my roadmap/i })).toBeDefined();
    // Nothing is generated until the student asks.
    expect(await mockRoadmapEngine.getActiveRoadmap(studentId)).toBeNull();
  });

  it("generates the roadmap and reveals milestones with one current", async () => {
    await lockGoal();
    const user = userEvent.setup();
    renderFlow();
    await user.click(
      await screen.findByRole("button", { name: /Generate my roadmap/i }),
    );

    expect(await screen.findByText(/Your JavaScript path/i)).toBeDefined();
    expect(screen.getByText(/Fits commitment/i)).toBeDefined();
    // Exactly one current milestone.
    const current = screen.getAllByRole("listitem").filter(
      (li) => li.getAttribute("aria-current") === "step",
    );
    expect(current).toHaveLength(1);
    // The current milestone starts expanded: units + checkpoint visible.
    expect(screen.getAllByText(/Checkpoint/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/You're ready when/i)).toBeDefined();
    expect(screen.getByText(/You are here:/i)).toBeDefined();
    // Persisted for Phase 7 and refreshes.
    expect((await mockRoadmapEngine.getActiveRoadmap(studentId))?.status).toBe("active");
  });

  it("recovers from a failed generation with a retry — no dead end", async () => {
    await lockGoal();
    const { roadmapService } = await import("@/services/roadmap.service");
    const generateSpy = vi
      .spyOn(roadmapService, "generateRoadmap")
      .mockRejectedValueOnce(new RoadmapApiError("network", 0));

    const user = userEvent.setup();
    renderFlow();
    await user.click(
      await screen.findByRole("button", { name: /Generate my roadmap/i }),
    );

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByText(/couldn't reach the roadmap service/i)).toBeDefined();

    await user.click(screen.getByRole("button", { name: /Try again/i }));
    expect(await screen.findByText(/Your JavaScript path/i)).toBeDefined();
    expect(generateSpy).toHaveBeenCalledTimes(2);
    generateSpy.mockRestore();
  });

  it("surfaces an infeasible budget honestly, without a pointless retry", async () => {
    // 4 weeks × 2h = 8h — below the engine's minimum viable budget.
    await lockGoal(
      jsInput({
        timeframe: { weeks: 4, preset: true },
        weeklyCommitment: { hoursPerWeek: 2, preset: false },
      }),
    );
    const user = userEvent.setup();
    renderFlow();
    await user.click(
      await screen.findByRole("button", { name: /Generate my roadmap/i }),
    );

    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByText(/can't carry this path/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /Try again/i })).toBeNull();
  });
});

describe("/roadmap — roadmap view (§22/§23/§24)", () => {
  it("restores the roadmap on a fresh mount (simulated refresh)", async () => {
    const goalId = await lockGoal();
    await mockRoadmapEngine.generateRoadmap(goalId, studentId);
    renderFlow();

    expect(await screen.findByText(/Your JavaScript path/i)).toBeDefined();
    expect(screen.getByText(/Roadmap version 1/i)).toBeDefined();
    expect(screen.getByText(OUTCOME)).toBeDefined();
    expect(screen.getByText(/The path at a glance/i)).toBeDefined();
    expect(screen.getByRole("heading", { name: "Milestones" })).toBeDefined();
  });

  it("expands an upcoming milestone on click (aria-expanded semantics)", async () => {
    const goalId = await lockGoal();
    await mockRoadmapEngine.generateRoadmap(goalId, studentId);
    const user = userEvent.setup();
    renderFlow();
    await screen.findByText(/Your JavaScript path/i);

    const upcoming = screen
      .getAllByRole("button", { expanded: false })
      .find((button) => /Asynchronous JavaScript/.test(button.textContent ?? ""));
    expect(upcoming).toBeDefined();
    await user.click(upcoming!);

    await waitFor(() => expect(upcoming!.getAttribute("aria-expanded")).toBe("true"));
    // The expansion reveals the milestone's checkpoint success signal.
    expect(
      screen.getByText(/You can say why each bug happened/i),
    ).toBeDefined();
  });

  it("labels unit types and shows effort honestly", async () => {
    const goalId = await lockGoal();
    await mockRoadmapEngine.generateRoadmap(goalId, studentId);
    renderFlow();
    await screen.findByText(/Your JavaScript path/i);

    // currentLevel "developing" compresses depth-0 material into a
    // review-first maintenance milestone (§13/§39) — visible in the UI.
    expect(screen.getAllByText(/Keeping a strength sharp/).length).toBeGreaterThan(0);
    expect(screen.getByText("Review", { selector: "span" })).toBeDefined();
    expect(screen.getAllByText(/Outcome:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Evidence:/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/24 weeks|6 months/).length).toBeGreaterThan(0);
  });

  it("links the real execution entry — the Stage-6 placeholder is gone (Phase 7)", async () => {
    const goalId = await lockGoal();
    const { roadmap } = await mockRoadmapEngine.generateRoadmap(goalId, studentId);
    renderFlow();
    await screen.findByText(/Your JavaScript path/i);

    // The honest "execution arrives later" note was replaced by a real,
    // derived current-unit entry point.
    expect(screen.queryByText(/Daily execution arrives in a future update/i)).toBeNull();
    const firstUnit = [...roadmap.milestones]
      .sort((a, b) => a.order - b.order)[0]!
      .learningUnits.sort((a, b) => a.order - b.order)[0]!;
    const cta = await screen.findByRole("link", { name: /Start learning/i });
    expect(cta.getAttribute("href")).toBe(`/roadmap/learn/${firstUnit.id}`);

    // Still no fake gamified actions.
    expect(screen.queryByRole("button", { name: /Start mission/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Mark complete/i })).toBeNull();
  });

  it("overlays honest execution runtime states on the timeline (§14)", async () => {
    const goalId = await lockGoal();
    const { roadmap } = await mockRoadmapEngine.generateRoadmap(goalId, studentId);
    const firstUnit = [...roadmap.milestones]
      .sort((a, b) => a.order - b.order)[0]!
      .learningUnits.sort((a, b) => a.order - b.order)[0]!;
    await mockExecutionEngine.startLearningUnit(firstUnit.id, studentId);

    renderFlow();
    await screen.findByText(/Your JavaScript path/i);

    // The unit row carries its runtime badge; the plan itself is unchanged.
    expect(await screen.findByText("In progress", { selector: "span" })).toBeDefined();
    expect(screen.getByRole("link", { name: /Resume this unit/i })).toBeDefined();
    // The curriculum was never mutated by execution.
    expect((await mockRoadmapEngine.getActiveRoadmap(studentId))?.milestones[0]?.status).toBe(
      "in_progress",
    );
  });
});

describe("/roadmap — Arabic + RTL (§30)", () => {
  it("renders localized labels with dir=rtl (engine content stays English)", async () => {
    window.localStorage.setItem("mureeh.locale", "ar");
    const goalId = await lockGoal();
    await mockRoadmapEngine.generateRoadmap(goalId, studentId);
    renderFlow();

    expect((await screen.findAllByText(/المحطات/)).length).toBeGreaterThan(0);
    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
    expect(screen.getByText(/إلى أين تتجه/)).toBeDefined();
    expect(screen.getByText(/ميزانية الوقت/)).toBeDefined();
    // Milestone titles are deterministic engine mock content (documented).
    expect(screen.getByText(/Your JavaScript path/i)).toBeDefined();
  });

  it("renders the generation screen in Arabic", async () => {
    window.localStorage.setItem("mureeh.locale", "ar");
    await lockGoal();
    renderFlow();
    expect(
      await screen.findByRole("heading", { name: /هدفك مقفل/ }),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: /ولّد خارطة طريقي/ })).toBeDefined();
  });
});
