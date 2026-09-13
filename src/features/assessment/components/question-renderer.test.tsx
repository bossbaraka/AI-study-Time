/**
 * Question rendering — every type renders accessibly, validates, and
 * produces exactly one typed response variant.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { QuestionRenderer } from "@/features/assessment/components/question-renderer";
import { I18nProvider } from "@/lib/i18n/provider";
import type { AssessmentQuestion, AssessmentResponse } from "@/types/assessment";

const MC_QUESTION: AssessmentQuestion = {
  id: "cl_f1",
  type: "multiple_choice",
  prompt: "Which statement best explains a JavaScript closure?",
  instructions: "Choose the statement that best describes it.",
  options: [
    { id: "a", label: "A function that keeps access to variables from where it was created" },
    { id: "b", label: "A way to close the browser window from code" },
  ],
  topic: "closures",
  difficulty: "foundational",
  estimatedSeconds: 60,
};

const SHORT_QUESTION: AssessmentQuestion = {
  id: "sc_a1",
  type: "short_answer",
  prompt: "Explain in your own words: what does “scope” mean?",
  topic: "scope",
  difficulty: "advanced",
  estimatedSeconds: 90,
};

const SCENARIO_QUESTION: AssessmentQuestion = {
  id: "sc_i1",
  type: "scenario",
  prompt: "What would you check first?",
  context: "A variable seems to have a different value inside one function.",
  options: [
    { id: "a", label: "Whether the function shadows the outer variable" },
    { id: "b", label: "Whether the file was saved" },
  ],
  topic: "scope",
  difficulty: "intermediate",
  estimatedSeconds: 90,
};

const PROBLEM_QUESTION: AssessmentQuestion = {
  id: "cl_a1",
  type: "problem_solving",
  prompt: "Describe what you would investigate first, and why.",
  context: "A function unexpectedly retains access to an old variable value.",
  topic: "closures",
  difficulty: "advanced",
  estimatedSeconds: 120,
};

function renderQuestion(
  question: AssessmentQuestion,
  onAnswer: (response: AssessmentResponse) => void = vi.fn(),
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <I18nProvider>{children}</I18nProvider>
  );
  render(
    <QuestionRenderer
      question={question}
      isSubmitting={false}
      submitError={null}
      onRetrySubmit={vi.fn()}
      onAnswer={onAnswer}
    />,
    { wrapper },
  );
  return onAnswer;
}

describe("QuestionRenderer", () => {
  it("renders a multiple-choice question as real radio inputs", async () => {
    const user = userEvent.setup();
    const onAnswer = renderQuestion(MC_QUESTION);

    expect(screen.getByRole("heading", { name: MC_QUESTION.prompt })).toBeTruthy();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(2);

    await user.click(radios[0]!);
    expect((radios[0] as HTMLInputElement).checked).toBe(true);

    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    await waitFor(() =>
      expect(onAnswer).toHaveBeenCalledWith({
        type: "multiple_choice",
        questionId: "cl_f1",
        optionId: "a",
      }),
    );
  });

  it("blocks an empty multiple-choice submission with an accessible error", async () => {
    const user = userEvent.setup();
    const onAnswer = renderQuestion(MC_QUESTION);

    await user.click(screen.getByRole("button", { name: "Submit answer" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Choose an answer to continue.")).toBeTruthy();
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it("renders a short-answer question with a labelled textarea and validates emptiness", async () => {
    const user = userEvent.setup();
    const onAnswer = renderQuestion(SHORT_QUESTION);

    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(await screen.findByText("Add your answer to continue.")).toBeTruthy();
    expect(onAnswer).not.toHaveBeenCalled();

    await user.type(screen.getByRole("textbox"), "where a variable can be seen");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    await waitFor(() =>
      expect(onAnswer).toHaveBeenCalledWith({
        type: "short_answer",
        questionId: "sc_a1",
        answer: "where a variable can be seen",
      }),
    );
  });

  it("renders scenario context plus an optional reasoning field", async () => {
    const user = userEvent.setup();
    const onAnswer = renderQuestion(SCENARIO_QUESTION);

    expect(screen.getByText(SCENARIO_QUESTION.context!)).toBeTruthy();
    expect(screen.getByLabelText(/Walk Mureeh through your thinking/)).toBeTruthy();

    await user.click(screen.getAllByRole("radio")[0]!);
    await user.type(
      screen.getByLabelText(/Walk Mureeh through your thinking/),
      "shadowing changes which binding is read",
    );
    await user.click(screen.getByRole("button", { name: "Submit answer" }));

    await waitFor(() =>
      expect(onAnswer).toHaveBeenCalledWith({
        type: "scenario",
        questionId: "sc_i1",
        optionId: "a",
        reasoning: "shadowing changes which binding is read",
      }),
    );
  });

  it("renders a problem-solving task and submits a free-form approach", async () => {
    const user = userEvent.setup();
    const onAnswer = renderQuestion(PROBLEM_QUESTION);

    // Micro-label and the sr-only textarea label both name the type.
    expect(screen.getAllByText("Problem solving").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(PROBLEM_QUESTION.context!)).toBeTruthy();

    await user.type(screen.getByRole("textbox"), "look for a captured reference");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));

    await waitFor(() =>
      expect(onAnswer).toHaveBeenCalledWith({
        type: "problem_solving",
        questionId: "cl_a1",
        answer: "look for a captured reference",
      }),
    );
  });
});
