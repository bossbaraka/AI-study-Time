import type {
  Achievement,
  AppNotification,
  BehaviorProfile,
  Certificate,
  DailyPlan,
  Goal,
  GuardianSummary,
  LearningResource,
  MentorContext,
  MentorMessage,
  Mission,
  ModuleMastery,
  RecallCard,
  RecallSessionStats,
  RecoveryPlan,
  Roadmap,
  StudentProfile,
  SubscriptionPlan,
  Test,
  TestResult,
} from "@/types/domain";

/* ------------------------------------------------------------------ */
/* Student & goal                                                      */
/* ------------------------------------------------------------------ */

export const mockStudent: StudentProfile = {
  id: "stu_01",
  fullName: "Layla Hassan",
  email: "layla.hassan@example.com",
  avatarInitials: "LH",
  locale: "en",
  timezone: "Asia/Hebron",
  memberSince: "2026-06-14",
  currentStage: "execute",
  subscriptionTier: "pro",
  guardianLinked: true,
};

export const mockGoal: Goal = {
  id: "goal_01",
  title: "Become a Full-Stack Developer",
  description:
    "Move from web fundamentals to deploying production applications with a JavaScript-first stack.",
  locked: true,
  lockedAt: "2026-06-21",
  targetDate: "2027-03-30",
  overallProgress: 68,
  weeklyCommitmentHours: 12,
};

/* ------------------------------------------------------------------ */
/* Roadmap                                                             */
/* ------------------------------------------------------------------ */

export const mockRoadmap: Roadmap = {
  id: "rm_01",
  goalId: "goal_01",
  locked: true,
  lockedAt: "2026-06-23",
  phases: [
    {
      id: "ph_foundation",
      title: "Foundation",
      description: "How the web works, HTML semantics and CSS layout.",
      status: "mastered",
      progress: 100,
      estimatedHours: 26,
      modules: [
        { id: "mod_html", title: "HTML Semantics", status: "mastered", progress: 100 },
        { id: "mod_css", title: "CSS Layout", status: "mastered", progress: 100 },
        { id: "mod_web", title: "How the Web Works", status: "completed", progress: 100 },
      ],
    },
    {
      id: "ph_js_basics",
      title: "JavaScript Basics",
      description: "Values, control flow, functions and the DOM.",
      status: "mastered",
      progress: 100,
      estimatedHours: 34,
      modules: [
        { id: "mod_values", title: "Values & Types", status: "mastered", progress: 100 },
        { id: "mod_functions", title: "Functions", status: "mastered", progress: 100 },
        { id: "mod_dom", title: "DOM Manipulation", status: "completed", progress: 100 },
      ],
    },
    {
      id: "ph_js_fundamentals",
      title: "JavaScript Fundamentals",
      description: "Closures, scope, advanced functions and array methods.",
      status: "current",
      progress: 68,
      estimatedHours: 40,
      modules: [
        { id: "mod_arrays", title: "Array Methods", status: "mastered", progress: 100 },
        { id: "mod_advanced_fn", title: "Advanced Functions", status: "current", progress: 62 },
        { id: "mod_closures", title: "Closures & Scope", status: "current", progress: 45 },
        { id: "mod_this", title: "this & Prototypes", status: "locked", progress: 0 },
      ],
    },
    {
      id: "ph_async",
      title: "Async Programming",
      description: "Event loop, promises, async/await and data fetching.",
      status: "locked",
      progress: 0,
      estimatedHours: 30,
      modules: [
        { id: "mod_promises", title: "Promises", status: "locked", progress: 0 },
        { id: "mod_async_await", title: "async / await", status: "locked", progress: 0 },
        { id: "mod_fetch", title: "Fetching Data", status: "locked", progress: 0 },
      ],
    },
    {
      id: "ph_projects",
      title: "Projects",
      description: "Three portfolio builds with review checkpoints.",
      status: "locked",
      progress: 0,
      estimatedHours: 52,
      modules: [
        { id: "mod_proj_1", title: "Project 1 — Interface", status: "locked", progress: 0 },
        { id: "mod_proj_2", title: "Project 2 — API", status: "locked", progress: 0 },
        { id: "mod_proj_3", title: "Project 3 — Full Stack", status: "locked", progress: 0 },
      ],
    },
    {
      id: "ph_final",
      title: "Final Assessment",
      description: "Comprehensive evaluation against your goal.",
      status: "locked",
      progress: 0,
      estimatedHours: 8,
      modules: [{ id: "mod_final", title: "Final Evaluation", status: "locked", progress: 0 }],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Mission & daily plan                                                */
/* ------------------------------------------------------------------ */

export const mockMission: Mission = {
  id: "msn_01",
  moduleId: "mod_closures",
  phaseTitle: "JavaScript Fundamentals",
  topic: "JavaScript Closures",
  objective:
    "Explain how a closure captures its lexical scope, and predict the output of three closure patterns without running them.",
  estimatedMinutes: 30,
  difficulty: "intermediate",
  state: "not-started",
  elapsedSeconds: 0,
  resourceIds: ["res_closures_video", "res_closures_docs"],
  practiceTaskId: "task_closures_practice",
  recallSessionId: "recall_closures",
  quizId: "quiz_closures",
};

export const mockDailyPlan: DailyPlan = {
  date: new Date().toISOString().slice(0, 10),
  greetingKey: "greeting.morning",
  focusMinutesPlanned: 90,
  focusMinutesDone: 35,
  steps: [
    { step: "learn", state: "done" },
    { step: "practice", state: "active" },
    { step: "recall", state: "pending" },
    { step: "quiz", state: "pending" },
  ],
  mission: mockMission,
  streakDays: 12,
};

/* ------------------------------------------------------------------ */
/* Resources                                                           */
/* ------------------------------------------------------------------ */

export const mockResources: LearningResource[] = [
  {
    id: "res_closures_video",
    title: "Closures, visually explained",
    kind: "video",
    provider: "Curated by Mureeh",
    durationMinutes: 18,
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures",
    moduleId: "mod_closures",
  },
  {
    id: "res_closures_docs",
    title: "MDN — Closures reference",
    kind: "documentation",
    provider: "MDN Web Docs",
    durationMinutes: 12,
    url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Closures",
    moduleId: "mod_closures",
  },
  {
    id: "res_scope_article",
    title: "Lexical scope and the call stack",
    kind: "article",
    provider: "Curated by Mureeh",
    durationMinutes: 9,
    url: "https://developer.mozilla.org/en-US/docs/Glossary/Scope",
    moduleId: "mod_closures",
  },
  {
    id: "res_closures_exercise",
    title: "Counter & factory exercises",
    kind: "exercise",
    provider: "Mureeh practice set",
    durationMinutes: 20,
    url: "#",
    moduleId: "mod_closures",
  },
  {
    id: "res_this_video",
    title: "Understanding `this` binding",
    kind: "video",
    provider: "Curated by Mureeh",
    durationMinutes: 22,
    url: "#",
    moduleId: "mod_this",
  },
];

/* ------------------------------------------------------------------ */
/* Active recall                                                       */
/* ------------------------------------------------------------------ */

export const mockRecallCards: RecallCard[] = [
  {
    id: "rc_01",
    moduleId: "mod_closures",
    mode: "explain",
    prompt: "What is a JavaScript closure?",
    referenceAnswer:
      "A closure is a function bundled together with references to its surrounding lexical scope. The inner function keeps access to variables declared outside it, even after the outer function has returned.",
    lastConfidence: "medium",
    intervalDays: 2,
    dueToday: true,
  },
  {
    id: "rc_02",
    moduleId: "mod_closures",
    mode: "multiple-choice",
    prompt: "What does the inner function log after the outer function has returned?",
    choices: ["undefined", "The captured count value", "A ReferenceError", "null"],
    correctChoiceIndex: 1,
    referenceAnswer:
      "The captured count value — the closure retains the variable binding, not a copy of the value.",
    lastConfidence: null,
    intervalDays: 1,
    dueToday: true,
  },
  {
    id: "rc_03",
    moduleId: "mod_advanced_fn",
    mode: "short-answer",
    prompt: "Name two practical uses of closures in real code.",
    referenceAnswer:
      "Data privacy (module pattern), and stateful function factories such as counters, memoisation or event-handler configuration.",
    lastConfidence: "high",
    intervalDays: 5,
    dueToday: true,
  },
  {
    id: "rc_04",
    moduleId: "mod_arrays",
    mode: "problem-solving",
    prompt: "Given an array of orders, write the chain that returns the total of completed ones.",
    referenceAnswer:
      "orders.filter(o => o.status === 'completed').reduce((sum, o) => sum + o.total, 0)",
    lastConfidence: "high",
    intervalDays: 8,
    dueToday: true,
  },
  {
    id: "rc_05",
    moduleId: "mod_closures",
    mode: "scenario",
    prompt:
      "A loop creates three buttons, each logging its index. All log 3. Explain why, and fix it with a closure.",
    referenceAnswer:
      "With `var`, one shared binding is captured by all three closures. Use `let` (per-iteration binding) or wrap the handler in an IIFE that receives the index as a parameter.",
    lastConfidence: "low",
    intervalDays: 1,
    dueToday: true,
  },
];

export const mockRecallStats: RecallSessionStats = {
  dueToday: 5,
  completedToday: 2,
  averageConfidence: 64,
  retentionRate: 81,
};

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

export const mockTests: Test[] = [
  {
    id: "quiz_closures",
    title: "Closures & Scope — Module Quiz",
    moduleId: "mod_closures",
    phaseTitle: "JavaScript Fundamentals",
    status: "not-started",
    timeLimitMinutes: 15,
    questions: [
      {
        id: "q1",
        kind: "multiple-choice",
        prompt: "What is captured by a closure?",
        choices: [
          "A copy of the variable values at call time",
          "References to the variables in its lexical scope",
          "The entire global object",
          "Only the function's own parameters",
        ],
        correctChoiceIndex: 1,
        explanation:
          "A closure keeps live references to the bindings in its enclosing scope — not a snapshot of their values.",
        topic: "Closures",
        points: 20,
      },
      {
        id: "q2",
        kind: "multiple-choice",
        prompt: "A counter factory returns a function that increments a private `count`. Why is `count` safe from outside modification?",
        choices: [
          "Because it is declared with const",
          "Because it lives in the closure's scope, unreachable from outside",
          "Because JavaScript freezes function variables",
          "It is not safe — closures expose their variables",
        ],
        correctChoiceIndex: 1,
        explanation:
          "The variable is reachable only through the returned function. That is the module pattern's privacy guarantee.",
        topic: "Closures",
        points: 20,
      },
      {
        id: "q3",
        kind: "multiple-choice",
        prompt: "Which keyword creates a per-iteration binding inside a `for` loop?",
        choices: ["var", "let", "static", "const"],
        correctChoiceIndex: 1,
        explanation: "`let` is block-scoped, so each loop iteration gets a fresh binding that closures capture independently.",
        topic: "Scope",
        points: 20,
      },
      {
        id: "q4",
        kind: "short-answer",
        prompt: "In one or two sentences: when would a closure cause a memory concern?",
        explanation:
          "When a long-lived closure retains references to large objects that could otherwise be collected — e.g. handlers attached to detached DOM nodes.",
        topic: "Closures",
        points: 20,
      },
      {
        id: "q5",
        kind: "scenario",
        prompt:
          "A teammate's `setTimeout` inside a loop always logs the last index. Diagnose the cause and give the minimal fix.",
        explanation:
          "`var` shares one binding across iterations; by the time the callbacks run, it holds the final value. Fix: use `let`, or pass the index into an IIFE.",
        topic: "Scope",
        points: 20,
      },
    ],
  },
  {
    id: "test_js_fundamentals",
    title: "JavaScript Fundamentals — Module Test",
    moduleId: "mod_closures",
    phaseTitle: "JavaScript Fundamentals",
    status: "not-started",
    timeLimitMinutes: 40,
    questions: [],
  },
];

export const mockTestResult: TestResult = {
  testId: "test_prev_functions",
  score: 72,
  submittedAt: "2026-09-08",
  timeSpentSeconds: 1840,
  answers: [
    { questionId: "p1", correct: true },
    { questionId: "p2", correct: true },
    { questionId: "p3", correct: false },
    { questionId: "p4", correct: true },
    { questionId: "p5", correct: false },
  ],
  strongTopics: ["Functions"],
  needsReviewTopics: ["Closures", "Scope"],
  recommendation: "recovery-session",
  recommendationReason:
    "Two incorrect answers both concern variable lifetime inside nested scopes — the same root cause your recall sessions flagged.",
};

/* ------------------------------------------------------------------ */
/* Mastery                                                             */
/* ------------------------------------------------------------------ */

export const mockMastery: ModuleMastery[] = [
  {
    moduleId: "mod_closures",
    moduleTitle: "Closures & Scope",
    phaseTitle: "JavaScript Fundamentals",
    achieved: false,
    evidence: [
      { kind: "recall", label: "mastery.evidence.recall", state: "met", score: null, threshold: null, note: "5 of 5 due items retrieved" },
      { kind: "practice", label: "mastery.evidence.practice", state: "met", score: null, threshold: null, note: "Practice set completed" },
      { kind: "quiz", label: "mastery.evidence.quiz", state: "met", score: 78, threshold: 70, note: null },
      { kind: "module-test", label: "mastery.evidence.module-test", state: "partial", score: 61, threshold: 80, note: "Needs improvement" },
    ],
    nextAction: "mastery.flow",
  },
  {
    moduleId: "mod_arrays",
    moduleTitle: "Array Methods",
    phaseTitle: "JavaScript Fundamentals",
    achieved: true,
    evidence: [
      { kind: "recall", label: "mastery.evidence.recall", state: "met", score: null, threshold: null, note: null },
      { kind: "practice", label: "mastery.evidence.practice", state: "met", score: null, threshold: null, note: null },
      { kind: "quiz", label: "mastery.evidence.quiz", state: "met", score: 92, threshold: 70, note: null },
      { kind: "module-test", label: "mastery.evidence.module-test", state: "met", score: 88, threshold: 80, note: null },
    ],
    nextAction: "",
  },
];

/* ------------------------------------------------------------------ */
/* Behavior                                                            */
/* ------------------------------------------------------------------ */

export const mockBehavior: BehaviorProfile = {
  learningSpeed: 74,
  comprehension: 82,
  recall: 68,
  problemSolving: 71,
  focus: 79,
  discipline: 66,
  consistency: 73,
  timeManagement: 61,
  bestStudyWindow: "18:00 – 20:00",
  averageSessionMinutes: 42,
  delayPatternInsight: "You tend to delay tasks longer than 60 minutes.",
  recoverySuccessRate: 84,
  completionConsistency: 77,
  weeklyFocusMinutes: [
    { day: "Sun", minutes: 75, planned: 90 },
    { day: "Mon", minutes: 95, planned: 90 },
    { day: "Tue", minutes: 40, planned: 90 },
    { day: "Wed", minutes: 110, planned: 90 },
    { day: "Thu", minutes: 85, planned: 90 },
    { day: "Fri", minutes: 30, planned: 60 },
    { day: "Sat", minutes: 65, planned: 90 },
  ],
  recentDelays: [
    {
      id: "dl_01",
      taskTitle: "Advanced Functions — practice set",
      expectedAt: "2026-09-09T18:00:00Z",
      actualAt: "2026-09-10T09:30:00Z",
      delayMinutes: 930,
    },
    {
      id: "dl_02",
      taskTitle: "Array methods recall session",
      expectedAt: "2026-09-06T17:00:00Z",
      actualAt: "2026-09-06T18:20:00Z",
      delayMinutes: 80,
    },
    {
      id: "dl_03",
      taskTitle: "DOM manipulation quiz",
      expectedAt: "2026-09-03T18:00:00Z",
      actualAt: "2026-09-04T20:10:00Z",
      delayMinutes: 1570,
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Recovery                                                            */
/* ------------------------------------------------------------------ */

export const mockRecoveryPlan: RecoveryPlan = {
  id: "rec_01",
  moduleId: "mod_closures",
  moduleTitle: "Closures & Scope",
  triggerReason: "Module test score 61% — below the 80% mastery threshold.",
  diagnosis: "Weak conceptual understanding of variable lifetime in nested scopes.",
  currentStep: "review",
  steps: [
    { step: "diagnosis", done: true, detail: "Mureeh compared your test, recall and practice signals." },
    { step: "review", done: false, detail: "Re-read the closure reference and watch the visual explanation — 25 min." },
    { step: "practice", done: false, detail: "Six targeted exercises on captured bindings and the module pattern." },
    { step: "recall", done: false, detail: "Four retrieval items, including the scenario you missed." },
    { step: "retest", done: false, detail: "Retake the module test. Mastery unlocks at 80%." },
  ],
  retestId: "test_js_fundamentals",
};

/* ------------------------------------------------------------------ */
/* Mentor                                                              */
/* ------------------------------------------------------------------ */

export const mockMentorContext: MentorContext = {
  goalTitle: mockGoal.title,
  phaseTitle: "JavaScript Fundamentals",
  currentTaskTitle: "JavaScript Closures",
  recentPerformance: "Quiz 78% · Module test 61% · Recall retention 81%",
  weaknesses: ["Closures", "Scope"],
  recentDelays: 3,
  recoveryActive: true,
};

export const mockMentorMessages: MentorMessage[] = [
  {
    id: "mm_01",
    role: "mentor",
    content:
      "I'm your Mureeh mentor. I can see your goal, your current phase and your recent results — ask me anything about the journey.",
    createdAt: "2026-09-10T17:02:00Z",
    suggestions: [
      "Why am I struggling?",
      "Explain this",
      "Give me an example",
      "Test me",
      "Help me recover",
      "What should I do now?",
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Achievements & certificates                                         */
/* ------------------------------------------------------------------ */

export const mockAchievements: Achievement[] = [
  {
    id: "ach_01",
    title: "First Foundation Mastered",
    description: "Every piece of evidence agreed on the Foundation phase.",
    state: "earned",
    progress: 100,
    earnedAt: "2026-07-18",
    milestone: "Phase completed: Foundation",
  },
  {
    id: "ach_02",
    title: "Twelve Consistent Days",
    description: "Twelve days of planned study, without a perfect streak required.",
    state: "earned",
    progress: 100,
    earnedAt: "2026-09-05",
    milestone: "Execution consistency reached",
  },
  {
    id: "ach_03",
    title: "Recovered and Returned",
    description: "A failed module test turned into a passed recovery retest.",
    state: "earned",
    progress: 100,
    earnedAt: "2026-08-29",
    milestone: "Recovery cycle completed",
  },
  {
    id: "ach_04",
    title: "JavaScript Fundamentals Mastered",
    description: "Mastery evidence complete for every module in the phase.",
    state: "in-progress",
    progress: 68,
    earnedAt: null,
    milestone: "Phase in progress: JavaScript Fundamentals",
  },
  {
    id: "ach_05",
    title: "Async Programming Unlocked",
    description: "Reach the async phase with no unresolved recovery plans.",
    state: "locked",
    progress: 0,
    earnedAt: null,
    milestone: "Phase locked: Async Programming",
  },
  {
    id: "ach_06",
    title: "First Deployed Project",
    description: "A portfolio project shipped and reviewed.",
    state: "locked",
    progress: 0,
    earnedAt: null,
    milestone: "Phase locked: Projects",
  },
];

export const mockCertificates: Certificate[] = [
  {
    id: "cert_01",
    title: "Web Foundations",
    issuedFor: "Foundation phase mastery",
    status: "issued",
    issuedAt: "2026-07-20",
    credentialId: "MRH-FND-8842",
    missingRequirement: null,
  },
  {
    id: "cert_02",
    title: "JavaScript Basics",
    issuedFor: "JavaScript Basics phase mastery",
    status: "issued",
    issuedAt: "2026-08-22",
    credentialId: "MRH-JSB-1207",
    missingRequirement: null,
  },
  {
    id: "cert_03",
    title: "JavaScript Fundamentals",
    issuedFor: "JavaScript Fundamentals phase mastery",
    status: "pending-mastery",
    issuedAt: null,
    credentialId: null,
    missingRequirement: "Module test — Closures & Scope at 80% or above",
  },
];

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export const mockNotifications: AppNotification[] = [
  {
    id: "ntf_01",
    kind: "recovery",
    title: "Recovery plan ready",
    body: "Your Closures & Scope module test scored 61%. A five-step recovery plan is prepared.",
    createdAt: "2026-09-10T16:20:00Z",
    read: false,
    actionLabel: "Open recovery",
    actionHref: "/app/recovery",
  },
  {
    id: "ntf_02",
    kind: "mission",
    title: "Today's mission is ready",
    body: "Learn JavaScript Closures — 30 minutes, scheduled in your best window at 18:00.",
    createdAt: "2026-09-11T06:00:00Z",
    read: false,
    actionLabel: "Start mission",
    actionHref: "/app/mission",
  },
  {
    id: "ntf_03",
    kind: "delay",
    title: "Delay insight",
    body: "You tend to delay tasks longer than 60 minutes. Mureeh split today's practice into two shorter sets.",
    createdAt: "2026-09-10T09:35:00Z",
    read: true,
    actionLabel: "View behavior",
    actionHref: "/app/behavior",
  },
  {
    id: "ntf_04",
    kind: "mastery",
    title: "Array Methods mastered",
    body: "Recall, practice, quiz and module test all agree. Your roadmap updated automatically.",
    createdAt: "2026-09-07T19:10:00Z",
    read: true,
    actionLabel: null,
    actionHref: null,
  },
  {
    id: "ntf_05",
    kind: "mentor",
    title: "Mentor check-in",
    body: "You asked why closures feel harder than arrays. The full explanation is in your mentor thread.",
    createdAt: "2026-09-06T18:45:00Z",
    read: true,
    actionLabel: "Open mentor",
    actionHref: "/app/mentor",
  },
];

/* ------------------------------------------------------------------ */
/* Subscription                                                        */
/* ------------------------------------------------------------------ */

export const mockPlans: SubscriptionPlan[] = [
  {
    tier: "free",
    name: "Starter",
    monthlyPriceUsd: 0,
    description: "The core journey — goal, roadmap, missions and recall.",
    features: [
      "Adaptive assessment and goal lock",
      "Locked roadmap with phase tracking",
      "Daily missions and focus mode",
      "Active recall scheduler",
    ],
    current: false,
  },
  {
    tier: "pro",
    name: "Pro",
    monthlyPriceUsd: 12,
    description: "Full intelligence: mentor, recovery, insights and certificates.",
    features: [
      "Everything in Starter",
      "AI Mentor with journey context",
      "Diagnosis and recovery plans",
      "Learning and behavior insights",
      "Mastery certificates",
    ],
    current: true,
  },
  {
    tier: "family",
    name: "Family",
    monthlyPriceUsd: 19,
    description: "Pro plus guardian accounts and family progress sharing.",
    features: [
      "Everything in Pro",
      "Up to 4 student journeys",
      "Guardian oversight view",
      "Shared progress reports",
    ],
    current: false,
  },
];

/* ------------------------------------------------------------------ */
/* Guardian                                                            */
/* ------------------------------------------------------------------ */

export const mockGuardianSummary: GuardianSummary = {
  studentName: mockStudent.fullName,
  goalTitle: mockGoal.title,
  currentPhase: "JavaScript Fundamentals",
  overallProgress: mockGoal.overallProgress,
  weeklyFocusMinutes: 500,
  weeklyCommitmentHours: mockGoal.weeklyCommitmentHours,
  consistency: 77,
  recentHighlights: [
    { date: "2026-09-07", text: "Mastered the Array Methods module with evidence from all four sources." },
    { date: "2026-09-05", text: "Reached twelve consistent study days." },
    { date: "2026-08-29", text: "Completed a full recovery cycle after a difficult module test." },
  ],
  supportSuggestions: [
    "Protect the 18:00–20:00 window — it is her strongest study time.",
    "Long tasks above 60 minutes tend to slip. A short check-in halfway helps.",
    "Ask about the closures module rather than the score — she is mid-recovery.",
  ],
  alerts: [
    { level: "attention", text: "One module test below mastery threshold; a recovery plan is active." },
    { level: "info", text: "Three delays recorded in the last two weeks, all on longer tasks." },
  ],
};
