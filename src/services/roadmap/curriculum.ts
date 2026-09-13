/**
 * Curriculum content + allocation policy for the deterministic roadmap
 * engine. All educational content of the mock phase lives HERE (English
 * mock content by design — see §30: UI labels are localized, engine
 * content is swappable when the real planner lands).
 *
 * Every capability declares explicit prerequisites (`dependsOn`), a depth
 * on the 0–5 target-level scale (the same scale Phase 5 uses), a natural
 * effort estimate (`baseHours`) and the checkpoint type that proves it.
 * Nothing is included "because it is popular": the engine only selects
 * capabilities for the goal's domain, bounded by the goal's target level,
 * adjusted by the diagnosis.
 */

import type { AssessmentTopicId } from "@/types/assessment";
import type { CheckpointType, LearningUnitType } from "@/types/roadmap";

export type CurriculumStage = "foundation" | "core" | "applied" | "production";

export interface CapabilityTemplate {
  id: string;
  /** Goal-domain preset ids this capability serves. */
  domains: readonly string[];
  stage: CurriculumStage;
  /** 0–5 on the target-level scale; included when depth ≤ target index. */
  depth: number;
  title: string;
  /** Why this capability matters — becomes unit purposes. */
  description: string;
  learningOutcome: string;
  dependsOn: readonly string[];
  baseHours: number;
  checkpoint: CheckpointType;
  /** Assessment topics this capability reinforces (diagnosis mapping). */
  assessmentTopics?: readonly AssessmentTopicId[];
}

/* ------------------------------------------------------------------ */
/* Allocation policy (§15/§16) — the ONLY place these numbers exist    */
/* ------------------------------------------------------------------ */

export interface UnitSlot {
  type: LearningUnitType;
  share: number;
}

export const ALLOCATION_POLICY = {
  /**
   * How a milestone's hours split into learning units, per stage.
   * Rationale: foundations need concept time + equal practice; core skills
   * shift toward building; applied work is mostly building; production
   * milestones are dominated by the deliverable, with review + self-check.
   */
  unitSplit: {
    foundation: [
      { type: "learn", share: 0.4 },
      { type: "practice", share: 0.4 },
      { type: "reflect", share: 0.2 },
    ],
    core: [
      { type: "learn", share: 0.3 },
      { type: "practice", share: 0.4 },
      { type: "build", share: 0.3 },
    ],
    applied: [
      { type: "practice", share: 0.35 },
      { type: "build", share: 0.5 },
      { type: "review", share: 0.15 },
    ],
    production: [
      { type: "build", share: 0.6 },
      { type: "review", share: 0.2 },
      { type: "assess", share: 0.2 },
    ],
  } satisfies Record<CurriculumStage, UnitSlot[]>,
  /** Strengths are preserved, not re-taught: review-first, compressed. */
  maintenanceSplit: [
    { type: "review", share: 0.4 },
    { type: "practice", share: 0.35 },
    { type: "reflect", share: 0.25 },
  ] as UnitSlot[],
  /** Honest budget verdicts: required ≤ available×TIGHT → "tight". */
  feasibility: {
    tightRatio: 1.35,
    /** Below this compression the path stops being viable → generation error. */
    minScale: 0.4,
    /** Absolute floor: a roadmap under this many hours is not a strategy. */
    minViableHours: 12,
  },
  /** Diagnosis hour multipliers — prioritize attention, preserve strengths. */
  diagnosis: {
    knowledgeGapFactor: 1.25,
    developingFactor: 1.1,
    strengthFactor: 0.5,
    /**
     * Capabilities below the student's starting level are not re-taught:
     * they compress into review-first maintenance milestones — unless the
     * diagnosis flags them as weak, which always wins.
     */
    priorKnowledgeFactor: 0.6,
  },
} as const;

/* ------------------------------------------------------------------ */
/* Capability tables                                                   */
/* ------------------------------------------------------------------ */

const CAPABILITIES: readonly CapabilityTemplate[] = [
  /* ---------------- JavaScript (maps 1:1 to assessment topics) ----- */
  {
    id: "js.functions",
    domains: ["javascript"],
    stage: "foundation",
    depth: 0,
    title: "Functions and execution flow",
    description:
      "Functions are the vocabulary of JavaScript — every later topic reads through them.",
    learningOutcome:
      "Write and call functions confidently: parameters, return values, and how execution flows through them.",
    dependsOn: [],
    baseHours: 6,
    checkpoint: "explain",
    assessmentTopics: ["functions"],
  },
  {
    id: "js.scope_closures",
    domains: ["javascript"],
    stage: "foundation",
    depth: 0,
    title: "Scope and closures",
    description:
      "Scope and closures explain why variables behave the way they do — the foundation of reliable debugging.",
    learningOutcome:
      "Explain lexical scope and implement a closure without following a tutorial.",
    dependsOn: ["js.functions"],
    baseHours: 8,
    checkpoint: "explain",
    assessmentTopics: ["scope", "closures"],
  },
  {
    id: "js.arrays_objects",
    domains: ["javascript"],
    stage: "core",
    depth: 1,
    title: "Arrays, objects and data transformation",
    description:
      "Real programs are data transformation — arrays and objects are where capability becomes visible.",
    learningOutcome:
      "Transform collections with map/filter/reduce and choose the right data shape for a problem.",
    dependsOn: ["js.functions"],
    baseHours: 8,
    checkpoint: "solve_new_problem",
    assessmentTopics: ["arrays"],
  },
  {
    id: "js.async",
    domains: ["javascript"],
    stage: "core",
    depth: 1,
    title: "Asynchronous JavaScript",
    description:
      "Async patterns are the gateway to APIs, interfaces and everything networked.",
    learningOutcome:
      "Understand and apply asynchronous JavaScript: promises, async/await, and error handling in real flows.",
    dependsOn: ["js.scope_closures", "js.arrays_objects"],
    baseHours: 10,
    checkpoint: "debug_unfamiliar",
    assessmentTopics: ["async"],
  },
  {
    id: "js.modules_tooling",
    domains: ["javascript"],
    stage: "core",
    depth: 2,
    title: "Modules and modern tooling",
    description:
      "Modules keep growing code understandable; tooling keeps it runnable.",
    learningOutcome:
      "Structure a multi-file project with ES modules and run it with a modern bundler or runtime.",
    dependsOn: ["js.async"],
    baseHours: 6,
    checkpoint: "build_feature",
  },
  {
    id: "js.testing",
    domains: ["javascript"],
    stage: "applied",
    depth: 2,
    title: "Testing JavaScript behaviour",
    description:
      "Tests turn 'it works on my machine' into evidence — introduced after there is real code to protect.",
    learningOutcome:
      "Write unit tests for pure functions and async behaviour, and use failures to locate bugs.",
    dependsOn: ["js.modules_tooling"],
    baseHours: 8,
    checkpoint: "build_feature",
  },
  {
    id: "js.capstone",
    domains: ["javascript"],
    stage: "production",
    depth: 3,
    title: "JavaScript capstone project",
    description:
      "Everything converges here: one project that proves the locked outcome.",
    learningOutcome:
      "Ship a tested JavaScript application that directly demonstrates the goal's success criteria.",
    dependsOn: ["js.async", "js.testing"],
    baseHours: 16,
    checkpoint: "practical_project",
  },

  /* ---------------- Frontend --------------------------------------- */
  {
    id: "fe.js_foundations",
    domains: ["frontend"],
    stage: "foundation",
    depth: 0,
    title: "JavaScript foundations for the web",
    description:
      "Every interface behaviour rests on functions, scope and data transformation.",
    learningOutcome:
      "Apply functions, scope and array methods confidently in browser code.",
    dependsOn: [],
    baseHours: 10,
    checkpoint: "solve_new_problem",
    assessmentTopics: ["functions", "scope", "closures", "arrays"],
  },
  {
    id: "fe.html_css",
    domains: ["frontend"],
    stage: "foundation",
    depth: 0,
    title: "Semantic HTML and CSS",
    description:
      "Structure and style are the craft underneath every framework.",
    learningOutcome:
      "Build an accessible, semantic page layout with modern CSS (flexbox/grid).",
    dependsOn: [],
    baseHours: 10,
    checkpoint: "build_feature",
  },
  {
    id: "fe.dom_events",
    domains: ["frontend"],
    stage: "core",
    depth: 1,
    title: "DOM and events",
    description:
      "Interfaces are conversations — the DOM and events are the language.",
    learningOutcome:
      "Make a page interactive: handle events and update the DOM deliberately.",
    dependsOn: ["fe.js_foundations", "fe.html_css"],
    baseHours: 8,
    checkpoint: "build_feature",
  },
  {
    id: "fe.responsive_a11y",
    domains: ["frontend"],
    stage: "core",
    depth: 1,
    title: "Responsive layout and accessibility",
    description:
      "A frontend that only works for some screens or some people is not finished.",
    learningOutcome:
      "Adapt layouts across screen sizes and verify them against core accessibility rules.",
    dependsOn: ["fe.html_css"],
    baseHours: 8,
    checkpoint: "build_feature",
  },
  {
    id: "fe.async_apis",
    domains: ["frontend"],
    stage: "core",
    depth: 2,
    title: "Async data and APIs",
    description:
      "Real interfaces live on data they do not own.",
    learningOutcome:
      "Fetch, display and handle failures for remote data with loading and error states.",
    dependsOn: ["fe.dom_events"],
    baseHours: 10,
    checkpoint: "debug_unfamiliar",
    assessmentTopics: ["async"],
  },
  {
    id: "fe.framework",
    domains: ["frontend"],
    stage: "applied",
    depth: 2,
    title: "Component-based UI with a modern framework",
    description:
      "Components turn interface logic into reusable, testable units.",
    learningOutcome:
      "Build a multi-view interface from components with props, state and composition.",
    dependsOn: ["fe.async_apis"],
    baseHours: 14,
    checkpoint: "build_feature",
  },
  {
    id: "fe.state_testing",
    domains: ["frontend"],
    stage: "applied",
    depth: 3,
    title: "State management and frontend testing",
    description:
      "Predictable state and tests are what separate demos from products.",
    learningOutcome:
      "Manage application state deliberately and cover key flows with component tests.",
    dependsOn: ["fe.framework"],
    baseHours: 12,
    checkpoint: "build_feature",
  },
  {
    id: "fe.capstone",
    domains: ["frontend"],
    stage: "production",
    depth: 3,
    title: "Frontend capstone project",
    description:
      "One deployed interface that proves the locked outcome.",
    learningOutcome:
      "Ship an accessible, data-driven frontend application matching the goal's success criteria.",
    dependsOn: ["fe.framework", "fe.state_testing", "fe.responsive_a11y"],
    baseHours: 20,
    checkpoint: "practical_project",
  },

  /* ---------------- Backend ---------------------------------------- */
  {
    id: "be.server_foundations",
    domains: ["backend"],
    stage: "foundation",
    depth: 0,
    title: "Server-side JavaScript foundations",
    description:
      "Backend work starts with the runtime, requests and responses.",
    learningOutcome:
      "Run a server-side JavaScript runtime and explain the request/response lifecycle.",
    dependsOn: [],
    baseHours: 8,
    checkpoint: "explain",
    assessmentTopics: ["functions", "scope"],
  },
  {
    id: "be.http_rest",
    domains: ["backend"],
    stage: "core",
    depth: 1,
    title: "HTTP and REST API design",
    description:
      "APIs are contracts — designing them well is the core backend craft.",
    learningOutcome:
      "Design and implement a REST API with correct methods, statuses and payloads.",
    dependsOn: ["be.server_foundations"],
    baseHours: 12,
    checkpoint: "build_feature",
    assessmentTopics: ["async"],
  },
  {
    id: "be.databases",
    domains: ["backend"],
    stage: "core",
    depth: 2,
    title: "Databases and data modelling",
    description:
      "Persistent, well-modelled data is what makes an application real.",
    learningOutcome:
      "Model domain data, store and query it, and migrate a schema safely.",
    dependsOn: ["be.http_rest"],
    baseHours: 12,
    checkpoint: "build_feature",
  },
  {
    id: "be.auth",
    domains: ["backend"],
    stage: "applied",
    depth: 2,
    title: "Authentication and authorization",
    description:
      "Identity decides who may do what — never an afterthought.",
    learningOutcome:
      "Implement signup/signin with hashed passwords, sessions or tokens, and route protection.",
    dependsOn: ["be.databases"],
    baseHours: 10,
    checkpoint: "build_feature",
  },
  {
    id: "be.testing",
    domains: ["backend"],
    stage: "applied",
    depth: 2,
    title: "Backend testing",
    description:
      "Tests protect the contract your API promises.",
    learningOutcome:
      "Test API endpoints and data access, including failure paths.",
    dependsOn: ["be.http_rest"],
    baseHours: 10,
    checkpoint: "build_feature",
  },
  {
    id: "be.deployment",
    domains: ["backend"],
    stage: "production",
    depth: 3,
    title: "Deployment and operations basics",
    description:
      "An API that only lives on your machine has not shipped.",
    learningOutcome:
      "Deploy an API with environment configuration and observe it running.",
    dependsOn: ["be.auth", "be.testing"],
    baseHours: 8,
    checkpoint: "build_feature",
  },
  {
    id: "be.capstone",
    domains: ["backend"],
    stage: "production",
    depth: 3,
    title: "Backend capstone project",
    description:
      "One tested, deployed API that proves the locked outcome.",
    learningOutcome:
      "Ship a tested REST API with authentication and database integration, matching the goal's success criteria.",
    dependsOn: ["be.deployment"],
    baseHours: 20,
    checkpoint: "practical_project",
  },

  /* ---------------- Software engineering --------------------------- */
  {
    id: "se.programming_foundations",
    domains: ["software_engineering"],
    stage: "foundation",
    depth: 0,
    title: "Programming foundations",
    description:
      "Clear thinking about state, functions and control flow precedes every tool.",
    learningOutcome:
      "Decompose a problem into functions and data, and implement it cleanly.",
    dependsOn: [],
    baseHours: 10,
    checkpoint: "solve_new_problem",
    assessmentTopics: ["functions", "arrays"],
  },
  {
    id: "se.version_control",
    domains: ["software_engineering"],
    stage: "foundation",
    depth: 0,
    title: "Version control and collaboration",
    description:
      "Engineering is a team sport; history is the shared memory.",
    learningOutcome:
      "Work with branches, commits and pull requests on a shared repository.",
    dependsOn: [],
    baseHours: 6,
    checkpoint: "build_feature",
  },
  {
    id: "se.data_structures",
    domains: ["software_engineering"],
    stage: "core",
    depth: 1,
    title: "Data structures",
    description:
      "Choosing the right structure is half of solving the problem.",
    learningOutcome:
      "Select and implement core data structures, explaining their trade-offs.",
    dependsOn: ["se.programming_foundations"],
    baseHours: 12,
    checkpoint: "solve_new_problem",
  },
  {
    id: "se.algorithms",
    domains: ["software_engineering"],
    stage: "core",
    depth: 1,
    title: "Algorithms and problem solving",
    description:
      "Algorithms train the precision that engineering interviews and real systems demand.",
    learningOutcome:
      "Solve unfamiliar algorithmic problems and analyse their complexity.",
    dependsOn: ["se.data_structures"],
    baseHours: 14,
    checkpoint: "solve_new_problem",
    assessmentTopics: ["arrays"],
  },
  {
    id: "se.design_principles",
    domains: ["software_engineering"],
    stage: "applied",
    depth: 2,
    title: "Software design principles",
    description:
      "Design keeps change cheap — the difference between code and a system.",
    learningOutcome:
      "Structure a small system with clear boundaries, naming and cohesion.",
    dependsOn: ["se.programming_foundations"],
    baseHours: 12,
    checkpoint: "debug_unfamiliar",
  },
  {
    id: "se.testing_quality",
    domains: ["software_engineering"],
    stage: "applied",
    depth: 2,
    title: "Testing and quality",
    description:
      "Quality is engineered in, not inspected in later.",
    learningOutcome:
      "Cover critical behaviour with tests and use CI feedback deliberately.",
    dependsOn: ["se.version_control", "se.design_principles"],
    baseHours: 12,
    checkpoint: "build_feature",
  },
  {
    id: "se.capstone",
    domains: ["software_engineering"],
    stage: "production",
    depth: 3,
    title: "Engineering capstone project",
    description:
      "A complete system built the way a team would build it.",
    learningOutcome:
      "Deliver a versioned, tested, documented application matching the goal's success criteria.",
    dependsOn: ["se.algorithms", "se.testing_quality"],
    baseHours: 24,
    checkpoint: "practical_project",
  },

  /* ---------------- AI ---------------------------------------------- */
  {
    id: "ai.python_foundations",
    domains: ["ai"],
    stage: "foundation",
    depth: 0,
    title: "Python foundations",
    description:
      "Python is the working language of AI tooling.",
    learningOutcome:
      "Write Python programs with functions, collections and error handling.",
    dependsOn: [],
    baseHours: 12,
    checkpoint: "solve_new_problem",
  },
  {
    id: "ai.math_for_ml",
    domains: ["ai"],
    stage: "core",
    depth: 1,
    title: "Mathematics for machine learning",
    description:
      "Models are math — enough fluency removes the magic.",
    learningOutcome:
      "Read and explain the linear algebra, probability and gradient ideas behind common models.",
    dependsOn: [],
    baseHours: 14,
    checkpoint: "explain",
  },
  {
    id: "ai.data_handling",
    domains: ["ai"],
    stage: "core",
    depth: 1,
    title: "Data handling and exploration",
    description:
      "Every model is only as honest as its data pipeline.",
    learningOutcome:
      "Load, clean and explore a real dataset, reporting what it can and cannot support.",
    dependsOn: ["ai.python_foundations"],
    baseHours: 12,
    checkpoint: "build_feature",
  },
  {
    id: "ai.ml_concepts",
    domains: ["ai"],
    stage: "applied",
    depth: 2,
    title: "Machine learning concepts",
    description:
      "Training, evaluation and failure modes — the core mental model.",
    learningOutcome:
      "Train and evaluate supervised models, explaining overfitting and metric choices.",
    dependsOn: ["ai.data_handling", "ai.math_for_ml"],
    baseHours: 16,
    checkpoint: "diagnostic_quiz",
  },
  {
    id: "ai.practice",
    domains: ["ai"],
    stage: "applied",
    depth: 2,
    title: "Applied model building",
    description:
      "Capability comes from iterating on real tasks, not watching demos.",
    learningOutcome:
      "Complete an end-to-end modelling task from raw data to evaluated predictions.",
    dependsOn: ["ai.ml_concepts"],
    baseHours: 14,
    checkpoint: "build_feature",
  },
  {
    id: "ai.capstone",
    domains: ["ai"],
    stage: "production",
    depth: 3,
    title: "AI capstone project",
    description:
      "One project that proves the locked outcome.",
    learningOutcome:
      "Ship a documented ML application matching the goal's success criteria.",
    dependsOn: ["ai.practice"],
    baseHours: 20,
    checkpoint: "practical_project",
  },

  /* ---------------- Data science ------------------------------------ */
  {
    id: "ds.python_foundations",
    domains: ["data_science"],
    stage: "foundation",
    depth: 0,
    title: "Python for data work",
    description:
      "Fluent, boring Python is the platform for everything else.",
    learningOutcome:
      "Write Python programs that manipulate collections and files reliably.",
    dependsOn: [],
    baseHours: 10,
    checkpoint: "solve_new_problem",
  },
  {
    id: "ds.statistics",
    domains: ["data_science"],
    stage: "core",
    depth: 1,
    title: "Statistics foundations",
    description:
      "Statistics is what keeps data conclusions honest.",
    learningOutcome:
      "Summarise data with correct descriptive and inferential statistics.",
    dependsOn: [],
    baseHours: 12,
    checkpoint: "diagnostic_quiz",
  },
  {
    id: "ds.wrangling",
    domains: ["data_science"],
    stage: "core",
    depth: 1,
    title: "Data wrangling",
    description:
      "Real data arrives messy; wrangling is the daily craft.",
    learningOutcome:
      "Clean, join and reshape a messy dataset into an analysis-ready form.",
    dependsOn: ["ds.python_foundations"],
    baseHours: 12,
    checkpoint: "build_feature",
  },
  {
    id: "ds.visualization",
    domains: ["data_science"],
    stage: "applied",
    depth: 2,
    title: "Visualization and communication",
    description:
      "An insight nobody can see is an insight nobody has.",
    learningOutcome:
      "Choose and build charts that answer a specific question without misleading.",
    dependsOn: ["ds.wrangling", "ds.statistics"],
    baseHours: 10,
    checkpoint: "build_feature",
  },
  {
    id: "ds.analysis",
    domains: ["data_science"],
    stage: "applied",
    depth: 2,
    title: "End-to-end analysis",
    description:
      "Question → data → analysis → conclusion: the full loop.",
    learningOutcome:
      "Run a complete analysis of a real dataset and defend its conclusions.",
    dependsOn: ["ds.visualization"],
    baseHours: 12,
    checkpoint: "solve_new_problem",
  },
  {
    id: "ds.capstone",
    domains: ["data_science"],
    stage: "production",
    depth: 3,
    title: "Data science capstone",
    description:
      "One published analysis that proves the locked outcome.",
    learningOutcome:
      "Deliver a documented data analysis project matching the goal's success criteria.",
    dependsOn: ["ds.analysis"],
    baseHours: 18,
    checkpoint: "practical_project",
  },

  /* ---------------- Cybersecurity ----------------------------------- */
  {
    id: "cy.network_foundations",
    domains: ["cybersecurity"],
    stage: "foundation",
    depth: 0,
    title: "Network foundations",
    description:
      "You cannot defend what you cannot trace — networks first.",
    learningOutcome:
      "Explain how data moves across a network and inspect real traffic.",
    dependsOn: [],
    baseHours: 10,
    checkpoint: "explain",
  },
  {
    id: "cy.os_linux",
    domains: ["cybersecurity"],
    stage: "foundation",
    depth: 0,
    title: "Operating systems and Linux",
    description:
      "Security work lives in the shell and the filesystem.",
    learningOutcome:
      "Administer a Linux system from the command line: users, permissions, processes.",
    dependsOn: [],
    baseHours: 10,
    checkpoint: "build_feature",
  },
  {
    id: "cy.security_principles",
    domains: ["cybersecurity"],
    stage: "core",
    depth: 1,
    title: "Security principles and threat modelling",
    description:
      "Threat modelling turns fear into a bounded, solvable problem.",
    learningOutcome:
      "Model threats for a small system and map defences to them.",
    dependsOn: ["cy.network_foundations"],
    baseHours: 10,
    checkpoint: "explain",
  },
  {
    id: "cy.web_security",
    domains: ["cybersecurity"],
    stage: "applied",
    depth: 2,
    title: "Web application security",
    description:
      "The web is the largest attack surface most systems have.",
    learningOutcome:
      "Find and fix common web vulnerabilities in a deliberately vulnerable app.",
    dependsOn: ["cy.security_principles"],
    baseHours: 12,
    checkpoint: "debug_unfamiliar",
  },
  {
    id: "cy.labs",
    domains: ["cybersecurity"],
    stage: "applied",
    depth: 2,
    title: "Security tooling and labs",
    description:
      "Tools amplify judgement — practised in safe, legal labs.",
    learningOutcome:
      "Complete guided security labs with standard tooling, documenting findings.",
    dependsOn: ["cy.os_linux", "cy.web_security"],
    baseHours: 12,
    checkpoint: "build_feature",
  },
  {
    id: "cy.capstone",
    domains: ["cybersecurity"],
    stage: "production",
    depth: 3,
    title: "Security capstone assessment",
    description:
      "A full assessment that proves the locked outcome.",
    learningOutcome:
      "Produce a security assessment report for a target system, matching the goal's success criteria.",
    dependsOn: ["cy.labs"],
    baseHours: 16,
    checkpoint: "practical_project",
  },

  /* ---------------- English ----------------------------------------- */
  {
    id: "en.grammar_core",
    domains: ["english"],
    stage: "foundation",
    depth: 0,
    title: "Core grammar in use",
    description:
      "Grammar is the scaffolding that makes meaning predictable.",
    learningOutcome:
      "Use the tense system and sentence structures correctly in your own writing.",
    dependsOn: [],
    baseHours: 10,
    checkpoint: "diagnostic_quiz",
  },
  {
    id: "en.vocabulary",
    domains: ["english"],
    stage: "foundation",
    depth: 0,
    title: "Vocabulary building",
    description:
      "Words are the raw material — a system beats a list.",
    learningOutcome:
      "Grow an active vocabulary with a spaced practice system you maintain.",
    dependsOn: [],
    baseHours: 8,
    checkpoint: "explain",
  },
  {
    id: "en.reading",
    domains: ["english"],
    stage: "core",
    depth: 1,
    title: "Reading comprehension",
    description:
      "Reading is how the language keeps teaching you after lessons end.",
    learningOutcome:
      "Extract main ideas, detail and inference from authentic texts.",
    dependsOn: ["en.vocabulary"],
    baseHours: 10,
    checkpoint: "solve_new_problem",
  },
  {
    id: "en.writing",
    domains: ["english"],
    stage: "core",
    depth: 1,
    title: "Structured writing",
    description:
      "Clear paragraphs are clear thinking made visible.",
    learningOutcome:
      "Write structured paragraphs and short essays with coherent argument.",
    dependsOn: ["en.grammar_core"],
    baseHours: 12,
    checkpoint: "build_feature",
  },
  {
    id: "en.speaking_listening",
    domains: ["english"],
    stage: "applied",
    depth: 2,
    title: "Speaking and listening",
    description:
      "Live language is the real test — fluency under time pressure.",
    learningOutcome:
      "Hold a sustained conversation and follow natural-speed listening.",
    dependsOn: ["en.reading"],
    baseHours: 12,
    checkpoint: "practical_project",
  },
  {
    id: "en.exam_capstone",
    domains: ["english"],
    stage: "production",
    depth: 3,
    title: "Exam-format capstone",
    description:
      "Full-length practice under real conditions proves readiness.",
    learningOutcome:
      "Complete a full practice exam and analyse the results against the goal's target.",
    dependsOn: ["en.writing", "en.speaking_listening"],
    baseHours: 14,
    checkpoint: "diagnostic_quiz",
  },

  /* ---------------- Mathematics -------------------------------------- */
  {
    id: "math.foundations",
    domains: ["mathematics"],
    stage: "foundation",
    depth: 0,
    title: "Foundations and number fluency",
    description:
      "Speed and confidence with basics free working memory for hard ideas.",
    learningOutcome:
      "Manipulate numbers, fractions, powers and ratios fluently and accurately.",
    dependsOn: [],
    baseHours: 10,
    checkpoint: "diagnostic_quiz",
  },
  {
    id: "math.algebra",
    domains: ["mathematics"],
    stage: "core",
    depth: 1,
    title: "Algebra",
    description:
      "Algebra is the grammar every later topic speaks.",
    learningOutcome:
      "Solve equations and inequalities and rearrange formulas confidently.",
    dependsOn: ["math.foundations"],
    baseHours: 14,
    checkpoint: "solve_new_problem",
  },
  {
    id: "math.functions_graphs",
    domains: ["mathematics"],
    stage: "core",
    depth: 1,
    title: "Functions and graphs",
    description:
      "Seeing a function is half of understanding it.",
    learningOutcome:
      "Analyse and sketch functions, connecting algebraic and graphical behaviour.",
    dependsOn: ["math.algebra"],
    baseHours: 12,
    checkpoint: "solve_new_problem",
  },
  {
    id: "math.statistics",
    domains: ["mathematics"],
    stage: "applied",
    depth: 2,
    title: "Statistics and probability",
    description:
      "Uncertainty has rules — statistics makes them usable.",
    learningOutcome:
      "Summarise data, compute probabilities and interpret results correctly.",
    dependsOn: ["math.algebra"],
    baseHours: 12,
    checkpoint: "solve_new_problem",
  },
  {
    id: "math.problem_solving",
    domains: ["mathematics"],
    stage: "applied",
    depth: 2,
    title: "Advanced problem solving",
    description:
      "Unfamiliar problems are where capability becomes real.",
    learningOutcome:
      "Solve multi-step unfamiliar problems, documenting the strategy used.",
    dependsOn: ["math.functions_graphs"],
    baseHours: 14,
    checkpoint: "solve_new_problem",
  },
  {
    id: "math.capstone",
    domains: ["mathematics"],
    stage: "production",
    depth: 3,
    title: "Mathematics capstone assessment",
    description:
      "A full problem set under exam conditions proves the locked outcome.",
    learningOutcome:
      "Complete a comprehensive problem set matching the goal's success criteria.",
    dependsOn: ["math.statistics", "math.problem_solving"],
    baseHours: 12,
    checkpoint: "diagnostic_quiz",
  },
];

/** English labels for preset domains (mock content — UI labels stay i18n). */
export const DOMAIN_LABELS_EN: Record<string, string> = {
  javascript: "JavaScript",
  frontend: "Frontend development",
  backend: "Backend development",
  software_engineering: "Software engineering",
  ai: "Artificial intelligence",
  data_science: "Data science",
  cybersecurity: "Cybersecurity",
  english: "English",
  mathematics: "Mathematics",
};

export function domainLabelEN(domain: { kind: string; presetId?: string; label?: string }): string {
  if (domain.kind === "custom") return domain.label ?? "your subject";
  return DOMAIN_LABELS_EN[domain.presetId ?? ""] ?? "your subject";
}

/** Capabilities declared for a preset domain, in declaration order. */
export function capabilitiesForDomain(presetId: string): CapabilityTemplate[] {
  return CAPABILITIES.filter((capability) => capability.domains.includes(presetId));
}

export function findCapability(id: string): CapabilityTemplate | undefined {
  return CAPABILITIES.find((capability) => capability.id === id);
}

/* ------------------------------------------------------------------ */
/* Custom domains — deterministic scaffold from the student's own goal  */
/* ------------------------------------------------------------------ */

function truncate(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Builds a generic-but-honest capability path for a custom domain:
 * foundations → guided practice → one applied milestone per success
 * criterion (max 3) → capstone. Content comes from the student's own
 * words, so the path always maps to the locked goal.
 */
export function buildCustomCapabilities(
  label: string,
  successCriteria: readonly string[],
): CapabilityTemplate[] {
  const capabilities: CapabilityTemplate[] = [
    {
      id: "custom.foundations",
      domains: ["custom"],
      stage: "foundation",
      depth: 0,
      title: `Core concepts of ${label}`,
      description: `The vocabulary and mental models everything else in ${label} rests on.`,
      learningOutcome: `Explain the core concepts of ${label} in your own words.`,
      dependsOn: [],
      baseHours: 10,
      checkpoint: "explain",
    },
    {
      id: "custom.guided_practice",
      domains: ["custom"],
      stage: "core",
      depth: 1,
      title: `Guided practice in ${label}`,
      description: `Repetition with feedback turns concepts into skill.`,
      learningOutcome: `Complete guided ${label} exercises and correct your own mistakes.`,
      dependsOn: ["custom.foundations"],
      baseHours: 10,
      checkpoint: "solve_new_problem",
    },
  ];

  const criteria = successCriteria.filter((c) => c.trim().length > 0).slice(0, 3);
  criteria.forEach((criterion, index) => {
    const previous =
      index === 0 ? "custom.guided_practice" : `custom.criterion_${index}`;
    capabilities.push({
      id: `custom.criterion_${index + 1}`,
      domains: ["custom"],
      stage: "applied",
      depth: 1,
      title: `Prove it: ${truncate(criterion, 60)}`,
      description: `One of your own success criteria, turned into a milestone you can complete.`,
      learningOutcome: `Demonstrate "${truncate(criterion, 80)}" with evidence you keep.`,
      dependsOn: [previous],
      baseHours: 10,
      checkpoint: "build_feature",
    });
  });

  capabilities.push({
    id: "custom.capstone",
    domains: ["custom"],
    stage: "production",
    depth: 2,
    title: `${label} capstone`,
    description: `Everything converges in one piece of work that proves the goal.`,
    learningOutcome: `Complete a ${label} project that satisfies your success criteria.`,
    dependsOn:
      criteria.length > 0
        ? [`custom.criterion_${criteria.length}`]
        : ["custom.guided_practice"],
    baseHours: 16,
    checkpoint: "practical_project",
  });

  return capabilities;
}
