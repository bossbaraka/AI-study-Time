import type {
  DailyLoopStep,
  JourneyStage,
  MasteryEvidenceKind,
  PhaseStatus,
  RecallMode,
  RecoveryStep,
} from "@/constants/journey";

/* ------------------------------------------------------------------ */
/* Identity & roles                                                    */
/* ------------------------------------------------------------------ */

export type UserRole = "student" | "guardian" | "admin";

export interface StudentProfile {
  id: string;
  fullName: string;
  email: string;
  avatarInitials: string;
  locale: string;
  timezone: string;
  memberSince: string; // ISO date
  currentStage: JourneyStage;
  subscriptionTier: SubscriptionTier;
  guardianLinked: boolean;
}

/* ------------------------------------------------------------------ */
/* Goal                                                                */
/* ------------------------------------------------------------------ */

export interface Goal {
  id: string;
  title: string;
  description: string;
  locked: boolean;
  lockedAt: string | null; // ISO
  targetDate: string | null; // ISO
  overallProgress: number; // 0–100
  weeklyCommitmentHours: number;
}

/* ------------------------------------------------------------------ */
/* Roadmap                                                             */
/* ------------------------------------------------------------------ */

export interface RoadmapPhase {
  id: string;
  title: string;
  description: string;
  status: PhaseStatus;
  progress: number; // 0–100
  estimatedHours: number;
  modules: RoadmapModule[];
}

export interface RoadmapModule {
  id: string;
  title: string;
  status: PhaseStatus;
  progress: number; // 0–100
}

export interface Roadmap {
  id: string;
  goalId: string;
  locked: boolean;
  lockedAt: string | null;
  phases: RoadmapPhase[];
}

/* ------------------------------------------------------------------ */
/* Daily plan, missions & tasks                                        */
/* ------------------------------------------------------------------ */

export type DailyStepState = "done" | "active" | "pending";

export interface DailyStep {
  step: DailyLoopStep;
  state: DailyStepState;
}

export type Difficulty = "beginner" | "intermediate" | "advanced";

export type MissionState = "not-started" | "in-progress" | "paused" | "completed";

export interface Mission {
  id: string;
  moduleId: string;
  phaseTitle: string;
  topic: string;
  objective: string;
  estimatedMinutes: number;
  difficulty: Difficulty;
  state: MissionState;
  elapsedSeconds: number;
  resourceIds: string[];
  practiceTaskId: string | null;
  recallSessionId: string | null;
  quizId: string | null;
}

export interface DailyPlan {
  date: string; // ISO date
  greetingKey: "greeting.morning" | "greeting.afternoon" | "greeting.evening";
  focusMinutesPlanned: number;
  focusMinutesDone: number;
  steps: DailyStep[];
  mission: Mission;
  streakDays: number;
}

/* ------------------------------------------------------------------ */
/* Learning resources                                                  */
/* ------------------------------------------------------------------ */

export type ResourceKind = "video" | "article" | "documentation" | "exercise" | "project";

export interface LearningResource {
  id: string;
  title: string;
  kind: ResourceKind;
  provider: string;
  durationMinutes: number;
  url: string;
  moduleId: string;
}

/* ------------------------------------------------------------------ */
/* Active recall                                                       */
/* ------------------------------------------------------------------ */

export interface RecallCard {
  id: string;
  moduleId: string;
  mode: RecallMode;
  prompt: string;
  referenceAnswer: string;
  choices?: string[];
  correctChoiceIndex?: number;
  lastConfidence: ConfidenceLevel | null;
  intervalDays: number;
  dueToday: boolean;
}

export type ConfidenceLevel = "low" | "medium" | "high";

export interface RecallSessionStats {
  dueToday: number;
  completedToday: number;
  averageConfidence: number; // 0–100
  retentionRate: number; // 0–100
}

/* ------------------------------------------------------------------ */
/* Tests & assessment                                                  */
/* ------------------------------------------------------------------ */

export type QuestionKind = "multiple-choice" | "short-answer" | "scenario";

export interface TestQuestion {
  id: string;
  kind: QuestionKind;
  prompt: string;
  choices?: string[];
  correctChoiceIndex?: number;
  explanation: string;
  topic: string;
  points: number;
}

export type TestStatus = "not-started" | "in-progress" | "submitted";

export interface Test {
  id: string;
  title: string;
  moduleId: string;
  phaseTitle: string;
  status: TestStatus;
  timeLimitMinutes: number | null; // null = untimed
  questions: TestQuestion[];
}

export interface TestResultAnswer {
  questionId: string;
  correct: boolean;
  givenChoiceIndex?: number;
  givenText?: string;
}

export interface TestResult {
  testId: string;
  score: number; // 0–100
  submittedAt: string;
  timeSpentSeconds: number;
  answers: TestResultAnswer[];
  strongTopics: string[];
  needsReviewTopics: string[];
  recommendation: "continue" | "review-then-continue" | "recovery-session";
  recommendationReason: string;
}

/* ------------------------------------------------------------------ */
/* Mastery                                                             */
/* ------------------------------------------------------------------ */

export type EvidenceState = "met" | "partial" | "missing";

export interface MasteryEvidence {
  kind: MasteryEvidenceKind;
  label: string;
  state: EvidenceState;
  /** Score-style evidence (quizzes, module tests): 0–100. Null for boolean evidence. */
  score: number | null;
  threshold: number | null;
  note: string | null;
}

export interface ModuleMastery {
  moduleId: string;
  moduleTitle: string;
  phaseTitle: string;
  achieved: boolean;
  evidence: MasteryEvidence[];
  nextAction: string;
}

/* ------------------------------------------------------------------ */
/* Behavior & delays                                                   */
/* ------------------------------------------------------------------ */

export interface DelayRecord {
  id: string;
  taskTitle: string;
  expectedAt: string; // ISO
  actualAt: string; // ISO
  delayMinutes: number;
}

export interface BehaviorProfile {
  learningSpeed: number; // 0–100
  comprehension: number;
  recall: number;
  problemSolving: number;
  focus: number;
  discipline: number;
  consistency: number;
  timeManagement: number;
  bestStudyWindow: string;
  averageSessionMinutes: number;
  delayPatternInsight: string;
  recoverySuccessRate: number; // 0–100
  completionConsistency: number; // 0–100
  weeklyFocusMinutes: { day: string; minutes: number; planned: number }[];
  recentDelays: DelayRecord[];
}

/* ------------------------------------------------------------------ */
/* Recovery                                                            */
/* ------------------------------------------------------------------ */

export interface RecoveryPlan {
  id: string;
  moduleId: string;
  moduleTitle: string;
  triggerReason: string;
  diagnosis: string;
  currentStep: RecoveryStep;
  steps: { step: RecoveryStep; done: boolean; detail: string }[];
  retestId: string;
}

/* ------------------------------------------------------------------ */
/* Mentor                                                              */
/* ------------------------------------------------------------------ */

export type MentorMessageRole = "student" | "mentor";

export interface MentorMessage {
  id: string;
  role: MentorMessageRole;
  content: string;
  createdAt: string; // ISO
  suggestions?: string[];
}

export interface MentorContext {
  goalTitle: string;
  phaseTitle: string;
  currentTaskTitle: string;
  recentPerformance: string;
  weaknesses: string[];
  recentDelays: number;
  recoveryActive: boolean;
}

/* ------------------------------------------------------------------ */
/* Achievements & certificates                                         */
/* ------------------------------------------------------------------ */

export type AchievementState = "earned" | "in-progress" | "locked";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  state: AchievementState;
  progress: number; // 0–100
  earnedAt: string | null;
  /** Achievements mark journey milestones — never "points for points' sake". */
  milestone: string;
}

export interface Certificate {
  id: string;
  title: string;
  issuedFor: string;
  status: "issued" | "pending-mastery";
  issuedAt: string | null;
  credentialId: string | null;
  missingRequirement: string | null;
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export type NotificationKind = "mission" | "recovery" | "delay" | "mastery" | "mentor" | "system";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string; // ISO
  read: boolean;
  actionLabel: string | null;
  actionHref: string | null;
}

/* ------------------------------------------------------------------ */
/* Subscription                                                        */
/* ------------------------------------------------------------------ */

export type SubscriptionTier = "free" | "pro" | "family";

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  monthlyPriceUsd: number;
  description: string;
  features: string[];
  current: boolean;
}

/* ------------------------------------------------------------------ */
/* Guardian                                                            */
/* ------------------------------------------------------------------ */

export interface GuardianSummary {
  studentName: string;
  goalTitle: string;
  currentPhase: string;
  overallProgress: number;
  weeklyFocusMinutes: number;
  weeklyCommitmentHours: number;
  consistency: number;
  recentHighlights: { date: string; text: string }[];
  supportSuggestions: string[];
  alerts: { level: "info" | "attention"; text: string }[];
}
