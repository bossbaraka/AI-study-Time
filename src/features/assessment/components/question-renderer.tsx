"use client";

import { MultipleChoiceQuestion } from "@/features/assessment/components/multiple-choice-question";
import { ProblemSolvingQuestion } from "@/features/assessment/components/problem-solving-question";
import { ScenarioQuestion } from "@/features/assessment/components/scenario-question";
import { ShortAnswerQuestion } from "@/features/assessment/components/short-answer-question";
import type { NormalizedAssessmentError } from "@/features/assessment/lib/errors";
import type { AssessmentQuestion, AssessmentResponse } from "@/types/assessment";

/**
 * Contract shared by every question-type component. The runner supplies
 * state; question components own nothing but their form.
 */
export interface QuestionComponentProps {
  question: AssessmentQuestion;
  isSubmitting: boolean;
  submitError: NormalizedAssessmentError | null;
  /** Retry the SAME submission (same idempotency key) after a transport failure. */
  onRetrySubmit: () => void;
  onAnswer: (response: AssessmentResponse) => void;
}

/**
 * Question renderer — pure dispatch on `question.type`.
 * Each question type is an independently maintainable component; this file
 * never grows type-specific logic.
 */
export function QuestionRenderer(props: QuestionComponentProps) {
  switch (props.question.type) {
    case "multiple_choice":
      return <MultipleChoiceQuestion {...props} />;
    case "short_answer":
      return <ShortAnswerQuestion {...props} />;
    case "scenario":
      return <ScenarioQuestion {...props} />;
    case "problem_solving":
      return <ProblemSolvingQuestion {...props} />;
  }
}
