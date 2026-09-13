/**
 * Assessment runner — integration against the real engine + service.
 * Covers the adaptive loop, §16 failure/retry with a stable idempotency
 * key, and lifecycle redirects (paused/completed/unknown sessions).
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { AssessmentRunner } from "@/features/assessment/components/assessment-runner";
import { I18nProvider } from "@/lib/i18n/provider";
import { ApiError } from "@/lib/api/client";
import { assessmentService } from "@/services/assessment.service";
import { mockAssessmentEngine } from "@/services/assessment/mock-assessment-engine";
import type { AssessmentQuestion, AssessmentResponse, SubmitAnswerPayload } from "@/types/assessment";

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
    motion: { div: tag("div"), p: tag("p"), span: tag("span") },
    AnimatePresence: ({ children }: { children: ReactNode }) =>
      react.createElement(react.Fragment, null, children),
  };
});

function renderRunner(sessionId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, createElement(I18nProvider, null, children));
  return render(<AssessmentRunner sessionId={sessionId} />, { wrapper });
}

/** Answers whatever question is on screen with the first valid input. */
async function answerCurrentQuestion(user: ReturnType<typeof userEvent.setup>) {
  const radios = screen.queryAllByRole("radio");
  if (radios.length > 0) {
    await user.click(radios[0]!);
  } else {
    await user.type(screen.getByRole("textbox"), "a thoughtful answer about closures and scope");
  }
  await user.click(screen.getByRole("button", { name: "Submit answer" }));
}

/** A minimal valid response for any rendered question (engine-side correctness irrelevant here). */
function firstValidResponse(question: AssessmentQuestion): AssessmentResponse {
  const firstOptionId = question.options?.[0]?.id ?? "a";
  switch (question.type) {
    case "multiple_choice":
      return { type: "multiple_choice", questionId: question.id, optionId: firstOptionId };
    case "scenario":
      return { type: "scenario", questionId: question.id, optionId: firstOptionId };
    case "short_answer":
      return { type: "short_answer", questionId: question.id, answer: "an answer" };
    case "problem_solving":
      return { type: "problem_solving", questionId: question.id, answer: "an answer" };
  }
}

describe("AssessmentRunner", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    pushMock.mockClear();
    vi.restoreAllMocks();
  });

  it("presents the engine's first question with honest progress", async () => {
    const session = mockAssessmentEngine.createSession();
    renderRunner(session.id);

    expect(await screen.findByRole("heading", { name: session.currentQuestion!.prompt })).toBeTruthy();
    expect(screen.getByText("0 questions explored")).toBeTruthy();
    expect(screen.queryByText(/of \d+/)).toBeNull(); // no "question X of Y"
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
  });

  it("advances to the next question after a submitted answer (adaptive loop)", async () => {
    const user = userEvent.setup();
    const session = mockAssessmentEngine.createSession();
    const firstPrompt = session.currentQuestion!.prompt;
    renderRunner(session.id);

    await screen.findByRole("heading", { name: firstPrompt });
    await answerCurrentQuestion(user);

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: firstPrompt })).toBeNull();
    });
    expect(screen.getByText("1 questions explored")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit answer" })).toBeTruthy();
  });

  it("never silently advances on a failed submission and retries the SAME submission (§16)", async () => {
    const user = userEvent.setup();
    const session = mockAssessmentEngine.createSession();
    renderRunner(session.id);
    await screen.findByRole("heading", { name: session.currentQuestion!.prompt });

    const submitSpy = vi.spyOn(assessmentService, "submitAnswer");
    submitSpy.mockRejectedValueOnce(new ApiError("network", 0, "network"));

    await answerCurrentQuestion(user);

    // Failure is surfaced, question stays on screen, progress unchanged.
    expect(await screen.findByText("We couldn't save your answer.")).toBeTruthy();
    expect(screen.getByText("Your progress has not been lost.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: session.currentQuestion!.prompt })).toBeTruthy();
    expect(screen.getByText("0 questions explored")).toBeTruthy();

    // Retry: same submissionId, engine counts the answer exactly once.
    submitSpy.mockImplementation((payload: SubmitAnswerPayload) =>
      Promise.resolve(mockAssessmentEngine.submitAnswer(payload)),
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getByText("1 questions explored")).toBeTruthy());
    expect(submitSpy).toHaveBeenCalledTimes(2);
    const [firstCall, retryCall] = submitSpy.mock.calls;
    expect(retryCall![0].submissionId).toBe(firstCall![0].submissionId);
  });

  it("redirects a completed session to its results screen", async () => {
    const session = mockAssessmentEngine.createSession();
    mockAssessmentEngine.completeSession(session.id);
    renderRunner(session.id);

    await waitFor(() =>
      expect(replaceMock).toHaveBeenCalledWith(`/assessment/results/${session.id}`),
    );
  });

  it("offers a calm resume for a paused session and restores the question", async () => {
    const user = userEvent.setup();
    const created = mockAssessmentEngine.createSession();
    const session = mockAssessmentEngine.submitAnswer({
      sessionId: created.id,
      response: firstValidResponse(created.currentQuestion!),
      submissionId: "sub_runner_paused",
    });
    mockAssessmentEngine.pauseSession(session.id);
    renderRunner(session.id);

    expect(await screen.findByRole("heading", { name: "Continue your assessment" })).toBeTruthy();
    expect(screen.getByText("You have completed 1 questions. Your progress is saved.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Continue assessment/i }));
    expect(await screen.findByRole("button", { name: "Submit answer" })).toBeTruthy();
  });

  it("shows a recovery path for an unknown session", async () => {
    renderRunner("asess_missing");

    expect(await screen.findByText("We couldn't load your assessment.")).toBeTruthy();
    expect(screen.getByText("Let's begin by understanding where you are today.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to assessment start" })).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
