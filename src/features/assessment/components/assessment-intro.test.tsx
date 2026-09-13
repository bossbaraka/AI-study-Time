/**
 * Assessment introduction — calm entry (§7), resume protection (§15)
 * and the create-session navigation contract.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { AssessmentIntro } from "@/features/assessment/components/assessment-intro";
import { I18nProvider } from "@/lib/i18n/provider";
import { mockAssessmentEngine } from "@/services/assessment/mock-assessment-engine";

const { replaceMock, pushMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
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
  const tag = (name: string) => (props: Record<string, unknown>) =>
    react.createElement(name, strip(props));
  return {
    motion: { div: tag("div"), p: tag("p") },
    AnimatePresence: ({ children }: { children: ReactNode }) =>
      react.createElement(react.Fragment, null, children),
  };
});

function renderIntro() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(I18nProvider, null, children),
    );
  return render(<AssessmentIntro />, { wrapper });
}

describe("AssessmentIntro", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    pushMock.mockClear();
  });

  it("explains why, how long and what to expect — without gamification", async () => {
    renderIntro();

    expect(
      await screen.findByRole("heading", {
        name: /where you are before deciding where you're going/i,
      }),
    ).toBeTruthy();
    expect(screen.getByText(/not a test you need to fear/i)).toBeTruthy();
    expect(screen.getByText(/calm diagnosis of your current level, not a grade/i)).toBeTruthy();
    expect(screen.getByText(/Questions adapt to your responses/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Begin assessment" })).toBeTruthy();
    // No XP/badges/streaks vocabulary anywhere on the screen.
    expect(document.body.textContent ?? "").not.toMatch(/XP|badge|streak|points/i);
  });

  it("creates a session and navigates to the runner", async () => {
    const user = userEvent.setup();
    renderIntro();

    await user.click(await screen.findByRole("button", { name: "Begin assessment" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledTimes(1));
    expect(pushMock.mock.calls[0]?.[0]).toMatch(/^\/assessment\/session\/asess_/);
  });

  it("offers an unfinished session first so progress is never lost by accident", async () => {
    let session = mockAssessmentEngine.createSession();
    session = mockAssessmentEngine.submitAnswer({
      sessionId: session.id,
      response: (() => {
        const q = session.currentQuestion!;
        if (q.type === "multiple_choice") {
          return { type: "multiple_choice" as const, questionId: q.id, optionId: q.options?.[0]?.id ?? "a" };
        }
        if (q.type === "scenario") {
          return { type: "scenario" as const, questionId: q.id, optionId: q.options?.[0]?.id ?? "a" };
        }
        if (q.type === "short_answer") {
          return { type: "short_answer" as const, questionId: q.id, answer: "an answer" };
        }
        return { type: "problem_solving" as const, questionId: q.id, answer: "an answer" };
      })(),
      submissionId: "sub_intro_1",
    });
    renderIntro();

    expect(await screen.findByRole("heading", { name: "Continue your assessment" })).toBeTruthy();
    expect(screen.getByText("You have completed 1 questions. Your progress is saved.")).toBeTruthy();

    await userEvent.setup().click(screen.getByRole("button", { name: /Continue assessment/i }));
    expect(pushMock).toHaveBeenCalledWith(`/assessment/session/${session.id}`);
  });

  it("warns before discarding an in-progress session", async () => {
    const user = userEvent.setup();
    mockAssessmentEngine.createSession();
    renderIntro();

    await screen.findByRole("heading", { name: "Continue your assessment" });
    await user.click(screen.getByRole("button", { name: "Start a new assessment" }));

    expect(await screen.findByText(/discard the progress of your current session/i)).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Keep current session" }));
    await waitFor(() => expect(screen.queryByText(/discard the progress/i)).toBeNull());
  });
});
