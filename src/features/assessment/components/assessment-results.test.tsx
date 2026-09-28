/**
 * Results screen — diagnostic summary rendering, supportive language,
 * recovery states and the STEP 5 hand-off navigation contract.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import { AssessmentResults } from "@/features/assessment/components/assessment-results";
import { I18nProvider } from "@/lib/i18n/provider";
import { authService } from "@/services/auth.service";
import { mockAssessmentEngine } from "@/services/engines";
import { findBankItem } from "@/services/assessment/question-bank";
import type { AssessmentQuestion, AssessmentResponse } from "@/types/assessment";

/**
 * Owner for direct engine calls. Component tests must use the id the
 * mock auth backend signs in (`usr_student_01`) so the service's
 * session-resolved student matches the engine's stored owner.
 */
const STUDENT = "usr_student_01";
const STUDENT_EMAIL = "layla.hassan@example.com";
const PASSWORD = "securePass1";

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
  return {
    motion: {
      div: (props: Record<string, unknown>) => react.createElement("div", strip(props)),
    },
    AnimatePresence: ({ children }: { children: ReactNode }) =>
      react.createElement(react.Fragment, null, children),
  };
});

function renderResults(sessionId: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(I18nProvider, null, children),
    );
  return render(<AssessmentResults sessionId={sessionId} />, { wrapper });
}

function correctResponse(question: AssessmentQuestion): AssessmentResponse {
  const item = findBankItem(question.id)!;
  switch (question.type) {
    case "multiple_choice":
      return {
        type: "multiple_choice",
        questionId: question.id,
        optionId:
          item.scoring.kind === "option" ? item.scoring.correctOptionId : "a",
      };
    case "scenario":
      return {
        type: "scenario",
        questionId: question.id,
        optionId: item.scoring.kind === "option" ? item.scoring.correctOptionId : "a",
      };
    case "short_answer":
    case "problem_solving":
      return {
        type: question.type,
        questionId: question.id,
        answer:
          item.scoring.kind === "keywords"
            ? item.scoring.keywords.slice(0, item.scoring.minMatches + 1).join(" and ")
            : "a considered answer",
      };
  }
}

/** Plays a full session answering everything correctly → completed. */
function playCompletedSession(): string {
  let session = mockAssessmentEngine.createSession(STUDENT);
  let guard = 0;
  while (session.status === "in_progress" && session.currentQuestion && guard < 20) {
    session = mockAssessmentEngine.submitAnswer({
      sessionId: session.id,
      response: correctResponse(session.currentQuestion),
      submissionId: `sub_${guard}`,
    }, STUDENT);
    guard += 1;
  }
  return session.id;
}

describe("AssessmentResults", () => {
  beforeEach(async () => {
    replaceMock.mockClear();
    // Assessment is now student-owned: the service resolves the owner
    // from the session, so the component tests must sign one in.
    await authService.login({ email: STUDENT_EMAIL, password: PASSWORD });
    pushMock.mockClear();
  });

  it("renders the diagnostic summary with strengths and a recommended start", async () => {
    const sessionId = playCompletedSession();
    renderResults(sessionId);

    expect(await screen.findByRole("heading", { name: /What Mureeh learned/i })).toBeTruthy();
    expect(screen.getByText("Assessment complete")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Strengths/ })).toBeTruthy();
    // Topics are rendered from translation keys, e.g. "Functions", "Closures".
    expect(screen.getAllByText(/Functions|Scope|Closures|Arrays|Async/).length).toBeGreaterThan(0);
    expect(screen.getByText("Recommended starting point")).toBeTruthy();
  });

  it("uses supportive insight language, never shame language", async () => {
    const sessionId = playCompletedSession();
    renderResults(sessionId);
    await screen.findByRole("heading", { name: /What Mureeh learned/i });

    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/failed|weak|bad at|poor/i);
    expect(body).toContain("You demonstrate strong");
  });

  it("hands off to Goal Discovery via the navigation contract only", async () => {
    const user = userEvent.setup();
    const sessionId = playCompletedSession();
    renderResults(sessionId);

    await user.click(await screen.findByRole("button", { name: "Continue" }));
    expect(pushMock).toHaveBeenCalledWith("/goals");
  });

  it("offers a way back to the session when results are not ready", async () => {
    const user = userEvent.setup();
    const session = mockAssessmentEngine.createSession(STUDENT);
    renderResults(session.id);

    expect(await screen.findByText("Your results are not ready yet.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /Continue assessment/i }));
    expect(replaceMock).toHaveBeenCalledWith(`/assessment/session/${session.id}`);
  });

  it("shows a recovery state for an unknown session", async () => {
    renderResults("asess_missing");

    expect(
      await screen.findByText(/we couldn't load the analysis yet/i),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to assessment start" })).toBeTruthy();
  });

  it("does not present a bare numeric score", async () => {
    const sessionId = playCompletedSession();
    renderResults(sessionId);
    await screen.findByRole("heading", { name: /What Mureeh learned/i });

    const body = document.body.textContent ?? "";
    expect(body).not.toMatch(/\b\d{1,3}%\b/);
    await waitFor(() => expect(screen.queryByText(/%/)).toBeNull());
  });
});
