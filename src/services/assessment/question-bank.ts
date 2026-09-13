/**
 * Mock diagnostic question bank — backend-owned content.
 *
 * IMPORTANT: scoring keys (`correctOptionId`, `keywords`) are internal to
 * the mock engine and are NEVER included in the `AssessmentQuestion`
 * objects handed to the UI (§37 — hidden evaluation criteria stay
 * server-side). A real backend serves questions from its own store; this
 * bank exists only so the adaptive engine has material to select from.
 */

import type { AssessmentQuestion, AssessmentTopicId } from "@/types/assessment";

/** Bank item = client-visible question + engine-only scoring data. */
export interface BankItem {
  question: AssessmentQuestion;
  scoring:
    | { kind: "option"; correctOptionId: string }
    | { kind: "keywords"; keywords: string[]; minMatches: number };
}

export const ASSESSMENT_TOPICS: AssessmentTopicId[] = [
  "functions",
  "scope",
  "closures",
  "arrays",
  "async",
];

function opt(id: string, label: string): { id: string; label: string } {
  return { id, label };
}

export const QUESTION_BANK: BankItem[] = [
  /* ---------------- functions ---------------- */
  {
    question: {
      id: "fn_f1",
      type: "multiple_choice",
      prompt: "What is a function in JavaScript?",
      instructions: "Choose the statement that best describes it.",
      options: [
        opt("a", "A reusable block of code that can take inputs and produce a result"),
        opt("b", "A file that stores data for the program"),
        opt("c", "A message the program prints to the screen"),
        opt("d", "A variable that can only hold numbers"),
      ],
      topic: "functions",
      difficulty: "foundational",
      estimatedSeconds: 45,
    },
    scoring: { kind: "option", correctOptionId: "a" },
  },
  {
    question: {
      id: "fn_i1",
      type: "multiple_choice",
      prompt:
        "A function is declared with two parameters, but it is called with only one argument. What does the second parameter hold inside the function?",
      options: [
        opt("a", "undefined"),
        opt("b", "null"),
        opt("c", "0"),
        opt("d", "The call throws an error"),
      ],
      topic: "functions",
      difficulty: "intermediate",
      estimatedSeconds: 60,
    },
    scoring: { kind: "option", correctOptionId: "a" },
  },
  {
    question: {
      id: "fn_a1",
      type: "short_answer",
      prompt: "In your own words: what is the difference between a parameter and an argument?",
      instructions: "A sentence or two is enough — there is no single required wording.",
      topic: "functions",
      difficulty: "advanced",
      estimatedSeconds: 90,
    },
    scoring: { kind: "keywords", keywords: ["parameter", "argument", "declaration", "call", "definition", "passed", "receives"], minMatches: 2 },
  },

  /* ---------------- scope ---------------- */
  {
    question: {
      id: "sc_f1",
      type: "multiple_choice",
      prompt: "A variable is declared with `let` inside an `if` block. Where can it be used?",
      options: [
        opt("a", "Only inside that block"),
        opt("b", "Anywhere in the file"),
        opt("c", "Anywhere in the program"),
        opt("d", "Only inside functions"),
      ],
      topic: "scope",
      difficulty: "foundational",
      estimatedSeconds: 45,
    },
    scoring: { kind: "option", correctOptionId: "a" },
  },
  {
    question: {
      id: "sc_i1",
      type: "scenario",
      prompt: "What would you check first?",
      context:
        "You are reading a program where a variable is defined near the top of a file, but inside one function it seems to have a completely different value than everywhere else.",
      instructions: "Pick the most likely first step. You can also explain your reasoning.",
      options: [
        opt("a", "Whether the function declares its own variable with the same name, shadowing the outer one"),
        opt("b", "Whether the file was saved correctly"),
        opt("c", "Whether the variable name is spelled with capital letters"),
        opt("d", "Whether the browser needs a refresh"),
      ],
      topic: "scope",
      difficulty: "intermediate",
      estimatedSeconds: 90,
    },
    scoring: { kind: "option", correctOptionId: "a" },
  },
  {
    question: {
      id: "sc_a1",
      type: "short_answer",
      prompt: "Explain in your own words: what does “scope” mean in programming?",
      instructions: "An example is welcome but not required.",
      topic: "scope",
      difficulty: "advanced",
      estimatedSeconds: 90,
    },
    scoring: { kind: "keywords", keywords: ["scope", "region", "where", "visible", "accessible", "block", "function", "access"], minMatches: 2 },
  },

  /* ---------------- closures ---------------- */
  {
    question: {
      id: "cl_f1",
      type: "multiple_choice",
      prompt: "Which statement best explains a JavaScript closure?",
      options: [
        opt("a", "A function that keeps access to variables from the place where it was created, even after that place has finished running"),
        opt("b", "A way to close the browser window from code"),
        opt("c", "A function that runs automatically every second"),
        opt("d", "A locked variable that can never be changed"),
      ],
      topic: "closures",
      difficulty: "foundational",
      estimatedSeconds: 60,
    },
    scoring: { kind: "option", correctOptionId: "a" },
  },
  {
    question: {
      id: "cl_i1",
      type: "multiple_choice",
      prompt:
        "A `makeCounter()` function creates a `count` variable, then returns a function that increments and returns `count`. Two counters are created: `a = makeCounter()` and `b = makeCounter()`. After calling `a()` three times and `b()` once, what does `b()` return next?",
      options: [opt("a", "2"), opt("b", "4"), opt("c", "1"), opt("d", "3")],
      topic: "closures",
      difficulty: "intermediate",
      estimatedSeconds: 90,
    },
    scoring: { kind: "option", correctOptionId: "a" },
  },
  {
    question: {
      id: "cl_a1",
      type: "problem_solving",
      prompt: "Describe what you would investigate first, and why.",
      context:
        "You are debugging an application where a function unexpectedly retains access to an old variable value, even though the code that created it finished running long ago.",
      instructions:
        "There is no single correct wording — describe your approach in any language or pseudocode you like.",
      topic: "closures",
      difficulty: "advanced",
      estimatedSeconds: 120,
    },
    scoring: { kind: "keywords", keywords: ["closure", "captured", "reference", "scope", "created", "outer", "environment", "retains"], minMatches: 2 },
  },

  /* ---------------- arrays ---------------- */
  {
    question: {
      id: "ar_f1",
      type: "multiple_choice",
      prompt: "Which array method creates a new array by transforming every element?",
      options: [opt("a", "map"), opt("b", "forEach"), opt("c", "push"), opt("d", "join")],
      topic: "arrays",
      difficulty: "foundational",
      estimatedSeconds: 45,
    },
    scoring: { kind: "option", correctOptionId: "a" },
  },
  {
    question: {
      id: "ar_i1",
      type: "multiple_choice",
      prompt:
        "Given `const nums = [1, 2, 3, 4, 5]`, what does `nums.filter(n => n % 2 === 0)` produce?",
      options: [
        opt("a", "[2, 4]"),
        opt("b", "[1, 3, 5]"),
        opt("c", "[false, true, false, true, false]"),
        opt("d", "10"),
      ],
      topic: "arrays",
      difficulty: "intermediate",
      estimatedSeconds: 60,
    },
    scoring: { kind: "option", correctOptionId: "a" },
  },
  {
    question: {
      id: "ar_a1",
      type: "scenario",
      prompt: "Which approach fits best?",
      context:
        "You have a list of user objects and need a new list containing only the display names of users who are active.",
      instructions: "Choose an approach and briefly say why, if you like.",
      options: [
        opt("a", "filter the active users, then map to their display names"),
        opt("b", "sort the users by name, then take the first half"),
        opt("c", "loop with push and two separate if statements per user"),
        opt("d", "join all users into one string, then split it"),
      ],
      topic: "arrays",
      difficulty: "advanced",
      estimatedSeconds: 90,
    },
    scoring: { kind: "option", correctOptionId: "a" },
  },

  /* ---------------- async ---------------- */
  {
    question: {
      id: "as_f1",
      type: "multiple_choice",
      prompt: "What does an `async` function always return?",
      options: [
        opt("a", "A promise"),
        opt("b", "A callback"),
        opt("c", "An event"),
        opt("d", "Nothing — it can only log output"),
      ],
      topic: "async",
      difficulty: "foundational",
      estimatedSeconds: 45,
    },
    scoring: { kind: "option", correctOptionId: "a" },
  },
  {
    question: {
      id: "as_i1",
      type: "multiple_choice",
      prompt:
        "In an async function, what does the `await` keyword do?",
      options: [
        opt("a", "Pauses the function until the promise settles, without blocking the rest of the program"),
        opt("b", "Stops the entire program until the promise settles"),
        opt("c", "Cancels the promise"),
        opt("d", "Turns the promise into a loop"),
      ],
      topic: "async",
      difficulty: "intermediate",
      estimatedSeconds: 60,
    },
    scoring: { kind: "option", correctOptionId: "a" },
  },
  {
    question: {
      id: "as_a1",
      type: "problem_solving",
      prompt: "Describe how you would structure this so failures are handled gracefully.",
      context:
        "You need to load data from two different APIs. The second request should only run if the first one succeeds, and the user should see a clear message if either fails.",
      instructions: "Pseudocode or plain description — whichever is clearer for you.",
      topic: "async",
      difficulty: "advanced",
      estimatedSeconds: 120,
    },
    scoring: { kind: "keywords", keywords: ["try", "catch", "await", "then", "promise", "error", "handle", "sequential"], minMatches: 2 },
  },
];

export function findBankItem(questionId: string): BankItem | undefined {
  return QUESTION_BANK.find((item) => item.question.id === questionId);
}

export function bankItemsForTopic(topic: AssessmentTopicId): BankItem[] {
  return QUESTION_BANK.filter((item) => item.question.topic === topic);
}
