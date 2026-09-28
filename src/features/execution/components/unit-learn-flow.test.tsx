/**
 * Learn screen UI (Phase 7, §20–§23): one clear current action per
 * state, honest evaluation copy, refresh persistence, dependency
 * blocking, Arabic + RTL, accessibility basics.
 * Runs against the REAL goal + roadmap + execution engines.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { LearnIndexFlow } from "@/features/execution/components/learn-index-flow";
import { UnitLearnFlow } from "@/features/execution/components/unit-learn-flow";
import { I18nProvider } from "@/lib/i18n/provider";
import { authService } from "@/services/auth.service";
import { mockExecutionEngine } from "@/services/engines";
import { mockGoalEngine } from "@/services/engines";
import { mockRoadmapEngine } from "@/services/engines";
import type { GoalDiscoveryInput } from "@/types/goal";
import type { Roadmap } from "@/types/roadmap";

const { pushMock, replaceMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: replaceMock }),
}));

const PASSWORD = "securePass1";
const STUDENT_EMAIL = "layla.hassan@example.com";

const SOLID_SOLUTION =
  "I built makeCounter(): a closure keeps `count` private and the returned function increments it.";
const SOLID_REASONING =
  "Closures capture the lexical scope at creation, so `count` survives between calls.";
const THIN_SOLUTION = "Did the exercise.";
const THIN_REASONING = "It works fine here.";

function jsInput(overrides: Partial<GoalDiscoveryInput> = {}): GoalDiscoveryInput {
  return {
    targetDomain: { kind: "preset", presetId: "javascript" },
    desiredOutcome: "Build and deploy two practical JavaScript apps with tests and clean code",
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
let roadmap: Roadmap;

function orderedUnitIds(): string[] {
  return [...roadmap.milestones]
    .sort((a, b) => a.order - b.order)
    .flatMap((milestone) =>
      [...milestone.learningUnits].sort((a, b) => a.order - b.order).map((unit) => unit.id),
    );
}

function renderWithProviders(node: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(I18nProvider, null, children),
    );
  return render(node, { wrapper });
}

function renderFlow(unitId?: string) {
  return renderWithProviders(<UnitLearnFlow learningUnitId={unitId ?? orderedUnitIds()[0]!} />);
}

async function seedRoadmap(): Promise<void> {
  const created = await mockGoalEngine.createGoal(jsInput(), {
    studentId,
    idempotencyKey: `ui-${Math.random()}`,
    diagnosisContext: null,
  });
  const locked = await mockGoalEngine.lockGoal(created.goal.id, studentId, `ui-lock-${Math.random()}`);
  roadmap = (await mockRoadmapEngine.generateRoadmap(locked.id, studentId)).roadmap;
}

beforeEach(async () => {
  window.localStorage.removeItem("mureeh.locale");
  vi.clearAllMocks();
  await mockExecutionEngine.__reset();
  await mockRoadmapEngine.__reset();
  await mockGoalEngine.__reset();
  const { session } = await authService.login({ email: STUDENT_EMAIL, password: PASSWORD });
  studentId = session.user.id;
  await seedRoadmap();
});

describe("learn screen — available unit (§7)", () => {
  it("shows the brief with ONE clear action and no form yet", async () => {
    renderFlow();
    const [firstUnitId] = orderedUnitIds();
    const unit = roadmap.milestones[0]!.learningUnits.find((u) => u.id === firstUnitId)!;

    // Goal/milestone context + the unit itself.
    expect(await screen.findByRole("heading", { level: 1, name: unit.title })).toBeDefined();
    expect(screen.getByText(unit.purpose)).toBeDefined();
    expect(screen.getByText(unit.expectedOutcome)).toBeDefined();
    expect(screen.getByText(unit.completionEvidence)).toBeDefined();
    // One primary action.
    expect(screen.getByRole("button", { name: /Start learning/i })).toBeDefined();
    // No evidence form before starting.
    expect(screen.queryByLabelText(/My solution/i)).toBeNull();
    // Way back to the plan.
    expect(screen.getByRole("link", { name: /Back to your roadmap/i })).toBeDefined();
  });

  it("starting reveals the task list and the evidence form", async () => {
    const user = userEvent.setup();
    renderFlow();
    await user.click(await screen.findByRole("button", { name: /Start learning/i }));

    expect(await screen.findByLabelText(/My solution/i)).toBeDefined();
    expect(screen.getByLabelText(/Why it works/i)).toBeDefined();
    expect(screen.getByRole("heading", { name: /Your task/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /Submit evidence/i })).toBeDefined();
    // Start is gone — exactly one current action.
    expect(screen.queryByRole("button", { name: /Start learning/i })).toBeNull();
  });
});

describe("learn screen — evidence & evaluation (§8/§9)", () => {
  async function startAndOpenForm() {
    const user = userEvent.setup();
    renderFlow();
    await user.click(await screen.findByRole("button", { name: /Start learning/i }));
    await screen.findByLabelText(/My solution/i);
    return user;
  }

  it("rejects empty evidence with supportive field errors", async () => {
    const user = await startAndOpenForm();
    await user.click(screen.getByRole("button", { name: /Submit evidence/i }));

    expect(await screen.findByText(/Add your solution before submitting/i)).toBeDefined();
    expect(screen.getByText(/Add why it works before submitting/i)).toBeDefined();
    // State unchanged — still in progress.
    expect((await mockExecutionEngine.getExecutionState(orderedUnitIds()[0]!, studentId))?.status).toBe(
      "in_progress",
    );
  });

  it("thin evidence → submitted recap → honest check → needs_review → retry prefills", async () => {
    const user = await startAndOpenForm();
    await user.type(screen.getByLabelText(/My solution/i), THIN_SOLUTION);
    await user.type(screen.getByLabelText(/Why it works/i), THIN_REASONING);
    await user.click(screen.getByRole("button", { name: /Submit evidence/i }));

    // Submitted recap + the honest description of the check.
    expect(await screen.findByRole("heading", { name: /Evidence submitted/i })).toBeDefined();
    expect(screen.getByText(THIN_SOLUTION)).toBeDefined();
    expect(screen.getByText(/automatic completeness check/i)).toBeDefined();

    await user.click(screen.getByRole("button", { name: /Check my evidence/i }));

    // needs_review — no false pass, no fake AI claims.
    const status = await screen.findByRole("status");
    expect(within(status).getByRole("heading", { name: /Needs review/i })).toBeDefined();
    expect(within(status).getByText(/couldn't confidently confirm/i)).toBeDefined();
    expect(screen.queryByText(/AI has analyzed/i)).toBeNull();

    // Explicit retry reopens the form WITH the previous evidence.
    await user.click(screen.getByRole("button", { name: /Try again/i }));
    const solution = (await screen.findByLabelText(/My solution/i)) as HTMLTextAreaElement;
    expect(solution.value).toBe(THIN_SOLUTION);
  });

  it("solid evidence passes and links the NEXT unit — not a fake celebration", async () => {
    const user = await startAndOpenForm();
    await user.type(screen.getByLabelText(/My solution/i), SOLID_SOLUTION);
    await user.type(screen.getByLabelText(/Why it works/i), SOLID_REASONING);
    await user.click(screen.getByRole("button", { name: /Submit evidence/i }));
    await user.click(await screen.findByRole("button", { name: /Check my evidence/i }));

    const status = await screen.findByRole("status");
    expect(within(status).getByRole("heading", { name: /Passed/i })).toBeDefined();

    const ids = orderedUnitIds();
    const nextLink = within(status).getByRole("link", { name: /Continue:/i });
    expect(nextLink.getAttribute("href")).toBe(`/roadmap/learn/${ids[1]}`);
  });

  it("refresh keeps the true state: in_progress shows the form, never Start again (§17)", async () => {
    const user = userEvent.setup();
    const firstMount = renderFlow();
    await user.click(await screen.findByRole("button", { name: /Start learning/i }));
    await user.type(await screen.findByLabelText(/My solution/i), "partial work in progress notes");

    // Simulated browser refresh: full unmount, then a fresh mount/cache.
    firstMount.unmount();
    renderFlow();

    expect(await screen.findByLabelText(/My solution/i)).toBeDefined();
    expect(screen.queryByRole("button", { name: /Start learning/i })).toBeNull();
    // The record itself still says in_progress — state came from the engine.
    expect((await mockExecutionEngine.getExecutionState(orderedUnitIds()[0]!, studentId))?.status).toBe(
      "in_progress",
    );
  });
});

describe("learn screen — gating & routing (§6/§21)", () => {
  it("a blocked unit renders an honest not-yet state", async () => {
    const ids = orderedUnitIds();
    renderFlow(ids[ids.length - 1]);
    expect(await screen.findByText(/Not available yet/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Back to your roadmap/i })).toBeDefined();
  });

  it("an unknown unit id is not found (same as a foreign one)", async () => {
    renderFlow("unit_does_not_exist");
    expect(await screen.findByText(/couldn't find that learning unit/i)).toBeDefined();
  });

  it("without any roadmap the flow defers to /roadmap", async () => {
    await mockRoadmapEngine.__reset();
    await mockExecutionEngine.__reset();
    renderFlow();
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith("/roadmap"));
  });

  it("/roadmap/learn resolves the ONE current unit and forwards", async () => {
    const ids = orderedUnitIds();
    await mockExecutionEngine.startLearningUnit(ids[0]!, studentId);
    renderWithProviders(<LearnIndexFlow />);
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith(`/roadmap/learn/${ids[0]}`));
  });

  it("/roadmap/learn with every unit passed shows the honest done state", async () => {
    for (const id of orderedUnitIds()) {
      await mockExecutionEngine.startLearningUnit(id, studentId);
      await mockExecutionEngine.submitEvidence(
        id,
        { solution: SOLID_SOLUTION, reasoning: SOLID_REASONING },
        studentId,
      );
      await mockExecutionEngine.evaluateExecution(id, studentId);
    }
    renderWithProviders(<LearnIndexFlow />);
    expect(await screen.findByText(/Every unit passed/i)).toBeDefined();
    expect(screen.queryByText(/100%/)).toBeNull();
  });
});

describe("learn screen — Arabic + RTL + accessibility (§20/§30)", () => {
  it("renders the full available screen in Arabic with dir=rtl", async () => {
    window.localStorage.setItem("mureeh.locale", "ar");
    const user = userEvent.setup();
    renderFlow();

    expect(await screen.findByRole("button", { name: /ابدأ التعلّم/ })).toBeDefined();
    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
    expect(screen.getByRole("link", { name: /العودة إلى خارطة طريقك/ })).toBeDefined();

    await user.click(screen.getByRole("button", { name: /ابدأ التعلّم/ }));
    expect(await screen.findByLabelText(/حلّي/)).toBeDefined();
    expect(screen.getByLabelText(/لماذا ينجح/)).toBeDefined();
    expect(screen.getByRole("button", { name: /قدّم الدليل/ })).toBeDefined();
  });

  it("renders the honest evaluation note in Arabic after submitting", async () => {
    window.localStorage.setItem("mureeh.locale", "ar");
    const user = userEvent.setup();
    renderFlow();
    await user.click(await screen.findByRole("button", { name: /ابدأ التعلّم/ }));
    await user.type(await screen.findByLabelText(/حلّي/), THIN_SOLUTION);
    await user.type(screen.getByLabelText(/لماذا ينجح/), THIN_REASONING);
    await user.click(screen.getByRole("button", { name: /قدّم الدليل/ }));

    expect(await screen.findByRole("heading", { name: /تم تقديم الدليل/ })).toBeDefined();
    expect(screen.getByText(/فحص اكتمال تلقائي/)).toBeDefined();
  });

  it("keeps the result region announced (aria-live) and actions labeled", async () => {
    await mockExecutionEngine.startLearningUnit(orderedUnitIds()[0]!, studentId);
    await mockExecutionEngine.submitEvidence(
      orderedUnitIds()[0]!,
      { solution: SOLID_SOLUTION, reasoning: SOLID_REASONING },
      studentId,
    );
    await mockExecutionEngine.evaluateExecution(orderedUnitIds()[0]!, studentId);
    renderFlow();

    // The skeleton is also role=status — target the result region itself.
    const heading = await screen.findByRole("heading", { name: /Passed/i });
    const status = heading.closest('[role="status"]');
    expect(status).not.toBeNull();
    expect(status?.getAttribute("aria-live")).toBe("polite");
  });
});
