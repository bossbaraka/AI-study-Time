/**
 * Goal discovery flow — end-to-end UI behaviour against the REAL engine
 * (§22): diagnosis acknowledgement, discovery form, validation feedback,
 * suggestion adoption, review, lock confirmation, error recovery with
 * input preservation, locked-state restoration, revision, and ar/RTL.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { GoalDiscoveryFlow } from "@/features/goals/components/goal-discovery-flow";
import { I18nProvider } from "@/lib/i18n/provider";
import { authService } from "@/services/auth.service";
import { mockAssessmentEngine } from "@/services/engines";
import { GoalApiError, goalDiscoveryService } from "@/services/goal-discovery.service";
import { mockGoalEngine } from "@/services/engines";
import type { AssessmentResult } from "@/types/assessment";
import type { GoalDiscoveryInput } from "@/types/goal";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
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

const STRONG_OUTCOME =
  "Build and deploy two practical backend apps with a database and authentication";

function strongInput(overrides: Partial<GoalDiscoveryInput> = {}): GoalDiscoveryInput {
  return {
    targetDomain: { kind: "preset", presetId: "backend" },
    desiredOutcome: STRONG_OUTCOME,
    motivation: { kind: "career" },
    currentLevel: "developing",
    targetLevel: "build_independently",
    timeframe: { weeks: 12, preset: true },
    weeklyCommitment: { hoursPerWeek: 7, preset: true },
    constraints: [],
    ...overrides,
  };
}

const FAKE_DIAGNOSIS: AssessmentResult = {
  sessionId: "session_fake",
  completedAt: new Date().toISOString(),
  questionsAnswered: 10,
  strengths: [{ topic: "functions", insight: "strong_conceptual", basedOnResponses: 3 }],
  developingAreas: [{ topic: "async", insight: "fundamentals_need_practice", basedOnResponses: 2 }],
  knowledgeGaps: [{ topic: "closures", insight: "conceptual_gap", basedOnResponses: 2 }],
  recommendedStartingPoint: { topic: "closures", level: "foundational" },
  confidence: "high",
};

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
  return render(<GoalDiscoveryFlow />, { wrapper });
}

async function seedGoal(
  input: GoalDiscoveryInput = strongInput(),
  opts: { lock?: boolean } = {},
) {
  const created = mockGoalEngine.createGoal(input, {
    studentId,
    idempotencyKey: `seed-${Math.random()}`,
    diagnosisContext: null,
  });
  if (opts.lock) {
    mockGoalEngine.lockGoal(created.goal.id, studentId, `seed-lock-${Math.random()}`);
  }
  return created.goal;
}

async function expectIntro() {
  return screen.findByRole("heading", { name: /You know where you stand/i });
}

async function startForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: /Start shaping my goal/i }));
  return screen.findByRole("textbox", {
    name: /What will you be able to do when you get there/i,
  });
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  outcome: string = STRONG_OUTCOME,
) {
  await user.click(await screen.findByRole("radio", { name: "Backend development" }));
  const textarea = screen.getByRole("textbox", {
    name: /What will you be able to do when you get there/i,
  });
  await user.type(textarea, outcome);
  await user.click(screen.getByRole("radio", { name: "Career" }));
  await user.click(screen.getByRole("radio", { name: "Developing" }));
  await user.click(screen.getByRole("radio", { name: "Build independently" }));
  await user.click(screen.getByRole("radio", { name: "3 months" }));
  await user.click(screen.getByRole("radio", { name: "7 hours/week" }));
  await user.click(screen.getByRole("button", { name: /Create my goal/i }));
}

beforeEach(async () => {
  window.localStorage.removeItem("mureeh.locale");
  mockGoalEngine.__reset();
  mockAssessmentEngine.__reset();
  const { session } = await authService.login({ email: STUDENT_EMAIL, password: PASSWORD });
  studentId = session.user.id;
});

describe("goal flow — intro (§6)", () => {
  it("acknowledges the diagnosis before asking for anything", async () => {
    vi.spyOn(mockAssessmentEngine, "getLatestCompletedResult").mockReturnValue(FAKE_DIAGNOSIS);
    renderFlow();
    await expectIntro();
    expect(
      await screen.findByRole("heading", { name: /What your assessment found/i }),
    ).toBeDefined();
    expect(screen.getByText("Functions")).toBeDefined();
    expect(screen.getAllByText(/Recommended starting point/i).length).toBeGreaterThan(0);
    // Nothing is collected yet — the CTA is the only way forward.
    expect(screen.queryByRole("textbox")).toBeNull();
    vi.restoreAllMocks();
  });

  it("offers the assessment when no diagnosis exists", async () => {
    renderFlow();
    await expectIntro();
    expect(await screen.findByText(/No completed assessment yet/i)).toBeDefined();
    expect(screen.getByRole("link", { name: /Take the assessment first/i })).toBeDefined();
  });

  it("prefills only the current level from the diagnosis — student decides", async () => {
    vi.spyOn(mockAssessmentEngine, "getLatestCompletedResult").mockReturnValue(FAKE_DIAGNOSIS);
    const user = userEvent.setup();
    renderFlow();
    await expectIntro();
    await startForm(user);
    // knowledgeGaps present → suggested starting level is "basic familiarity".
    await waitFor(() =>
      expect(
        (screen.getByRole("radio", { name: "Basic familiarity" }) as HTMLInputElement).checked,
      ).toBe(true),
    );
    expect(screen.getByText(/Suggested from your assessment/i)).toBeDefined();
    // Everything else stays unselected.
    expect(
      (screen.getByRole("radio", { name: "Build independently" }) as HTMLInputElement).checked,
    ).toBe(false);
    vi.restoreAllMocks();
  });
});

describe("goal flow — discovery → validation → review → lock (§9–§14)", () => {
  it("creates a strong goal and lands on the review", async () => {
    const user = userEvent.setup();
    renderFlow();
    await expectIntro();
    await startForm(user);
    await fillForm(user);

    expect(
      await screen.findByRole("heading", { name: /Your goal, in one view/i }),
    ).toBeDefined();
    expect(screen.getByText(STRONG_OUTCOME)).toBeDefined();
    expect(screen.getByRole("heading", { name: /What looks strong/i })).toBeDefined();
  });

  it("challenges a vague goal with supportive, non-judgemental feedback", async () => {
    const user = userEvent.setup();
    renderFlow();
    await expectIntro();
    await startForm(user);
    await fillForm(user, "I want to learn more about coding in general");

    expect(await screen.findByRole("heading", { name: /Sharpen your goal/i })).toBeDefined();
    expect(screen.getByText(/isn't a destination yet/i)).toBeDefined();
    // The student's own words are preserved in the form.
    expect(
      (
        screen.getByRole("textbox", {
          name: /What will you be able to do when you get there/i,
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("I want to learn more about coding in general");
  });

  it("applies a suggestion only when the student clicks, then re-validates", async () => {
    const user = userEvent.setup();
    renderFlow();
    await expectIntro();
    await startForm(user);
    await fillForm(user, "I want to learn more about coding in general");
    await screen.findByRole("heading", { name: /Sharpen your goal/i });

    expect(screen.getByText(/Ways to sharpen it/i)).toBeDefined();
    const useButtons = screen.getAllByRole("button", { name: /Use this suggestion/i });
    await user.click(useButtons[0]!);

    // The adopted suggestion makes the goal measurable → straight to review.
    expect(
      await screen.findByRole("heading", { name: /Your goal, in one view/i }),
    ).toBeDefined();
    // concrete_outcome template for build_independently was adopted.
    expect(screen.getByText(/Build a small .* project from scratch/i)).toBeDefined();
  });

  it("locks the goal through an explicit confirmation dialog", async () => {
    await seedGoal();
    const user = userEvent.setup();
    renderFlow();

    await screen.findByRole("heading", { name: /Your goal, in one view/i });
    await user.click(screen.getByRole("button", { name: /Lock this goal/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: /Lock this goal\?/i })).toBeDefined();
    await user.click(within(dialog).getByRole("button", { name: /Yes, lock it/i }));

    expect(await screen.findByRole("heading", { name: /Your goal is locked/i })).toBeDefined();
    expect(screen.getByText(/Locked on/i)).toBeDefined();
    const active = mockGoalEngine.getActiveGoal(studentId);
    expect(active?.status).toBe("locked");
  });

  it("shows what still needs attention on the review when warnings exist", async () => {
    await seedGoal(
      strongInput({
        currentLevel: "new_to_it",
        targetLevel: "work_professionally",
        timeframe: { weeks: 24, preset: true },
        weeklyCommitment: { hoursPerWeek: 4, preset: true },
      }),
    );
    renderFlow();
    await screen.findByRole("heading", { name: /Your goal, in one view/i });
    expect(screen.getByRole("heading", { name: /What still needs attention/i })).toBeDefined();
    expect(screen.getByText(/This timeline is tight/i)).toBeDefined();
  });
});

describe("goal flow — error recovery (§13/§14/§20)", () => {
  it("keeps the goal unlocked on a failed save and recovers via retry", async () => {
    const goal = await seedGoal();
    const spy = vi
      .spyOn(goalDiscoveryService, "lockGoal")
      .mockRejectedValueOnce(new GoalApiError("network", 0));

    const user = userEvent.setup();
    renderFlow();
    await screen.findByRole("heading", { name: /Your goal, in one view/i });
    await user.click(screen.getByRole("button", { name: /Lock this goal/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Yes, lock it/i }));

    // Recoverable error, goal NOT locked locally or in the store.
    expect(await screen.findByRole("alert")).toBeDefined();
    expect(screen.getByText(/couldn't save your goal/i)).toBeDefined();
    expect(screen.getByRole("heading", { name: /Your goal, in one view/i })).toBeDefined();
    expect(mockGoalEngine.getGoal(goal.id, studentId).status).toBe("validated");

    // Retry with the same idempotency key succeeds.
    await user.click(screen.getByRole("button", { name: /Try again/i }));
    expect(await screen.findByRole("heading", { name: /Your goal is locked/i })).toBeDefined();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[0]![1]).toBe(spy.mock.calls[1]![1]);
    spy.mockRestore();
  });
});

describe("goal flow — persistence, revision and navigation (§5/§14/§15)", () => {
  it("restores the locked goal on a fresh mount (simulated refresh)", async () => {
    const goal = await seedGoal(strongInput(), { lock: true });
    renderFlow();
    expect(await screen.findByRole("heading", { name: /Your goal is locked/i })).toBeDefined();
    expect(screen.getByText(STRONG_OUTCOME)).toBeDefined();
    expect(mockGoalEngine.getGoal(goal.id, studentId).status).toBe("locked");
  });

  it("offers explicit revision of a locked goal — never a silent unlock", async () => {
    const goal = await seedGoal(strongInput(), { lock: true });
    const user = userEvent.setup();
    renderFlow();
    await screen.findByRole("heading", { name: /Your goal is locked/i });

    await user.click(screen.getByRole("button", { name: /Revise this goal/i }));

    // The revision is a fresh editable goal; the original stays `revised`.
    expect(await screen.findByRole("heading", { name: /Your goal, in one view/i })).toBeDefined();
    expect(mockGoalEngine.getGoal(goal.id, studentId).status).toBe("revised");
    const active = mockGoalEngine.getActiveGoal(studentId);
    expect(active?.id).not.toBe(goal.id);
    expect(active?.status).not.toBe("locked");
  });

  it("routes the dashboard CTA to /app", async () => {
    await seedGoal(strongInput(), { lock: true });
    const user = userEvent.setup();
    renderFlow();
    await screen.findByRole("heading", { name: /Your goal is locked/i });
    await user.click(screen.getByRole("button", { name: /Go to my dashboard/i }));
    expect(pushMock).toHaveBeenCalledWith("/app");
  });
});

describe("goal flow — Arabic + RTL (§17/§18)", () => {
  it("renders the full flow in Arabic with dir=rtl", async () => {
    window.localStorage.setItem("mureeh.locale", "ar");
    renderFlow();

    expect(
      await screen.findByRole("heading", { name: /أصبحت تعرف أين تقف/ }),
    ).toBeDefined();
    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
    expect(
      screen.getByRole("button", { name: /ابدأ بصياغة هدفي/ }),
    ).toBeDefined();
  });

  it("renders the locked view in Arabic", async () => {
    window.localStorage.setItem("mureeh.locale", "ar");
    await seedGoal(strongInput(), { lock: true });
    renderFlow();
    expect(await screen.findByRole("heading", { name: /تم قفل هدفك/ })).toBeDefined();
    expect(screen.getByText(/قُفل في/)).toBeDefined();
  });
});
