import { QueryClient, isCancelledError } from "@tanstack/react-query";

/**
 * Query keys are namespaced by domain so invalidation is precise:
 * invalidate(["journey"]) refreshes goal + roadmap + plan together.
 */
export const queryKeys = {
  /** Auth session state — the root of all protected-route decisions. */
  session: ["auth", "session"] as const,
  student: ["student"] as const,
  goal: ["goal"] as const,
  /** STEP 5 discovery lifecycle — distinct from the dashboard's active goal. */
  goalDiscovery: ["goal-discovery"] as const,
  roadmap: ["roadmap"] as const,
  /** Phase 6 authoritative roadmap — distinct from the legacy dashboard mock. */
  roadmapActive: ["roadmap", "active"] as const,
  /** Phase 7 execution runtime state — layered over the roadmap plan. */
  executionView: ["execution", "view"] as const,
  executionUnit: (unitId: string) => ["execution", "unit", unitId] as const,
  dailyPlan: ["daily-plan"] as const,
  mission: (id?: string) => (id ? (["mission", id] as const) : (["mission"] as const)),
  resources: (moduleId?: string) =>
    moduleId ? (["resources", moduleId] as const) : (["resources"] as const),
  recall: ["recall"] as const,
  recallCards: ["recall", "cards"] as const,
  recallStats: ["recall", "stats"] as const,
  tests: ["tests"] as const,
  testResult: (id: string) => ["tests", "result", id] as const,
  mastery: ["mastery"] as const,
  behavior: ["behavior"] as const,
  recovery: ["recovery"] as const,
  mentor: ["mentor"] as const,
  mentorMessages: ["mentor", "messages"] as const,
  achievements: ["achievements"] as const,
  certificates: ["certificates"] as const,
  notifications: ["notifications"] as const,
  plans: ["subscription", "plans"] as const,
  guardian: ["guardian", "summary"] as const,
  assessment: ["assessment"] as const,
  assessmentActive: ["assessment", "active"] as const,
  assessmentLatestResult: ["assessment", "latest-result"] as const,
  assessmentSession: (id: string) => ["assessment", "session", id] as const,
  assessmentResults: (id: string) => ["assessment", "results", id] as const,
  journey: ["journey"] as const,
};

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          // Never retry aborted queries or 4xx responses.
          if (isCancelledError(error)) return false;
          const status = (error as { status?: number }).status;
          if (status && status >= 400 && status < 500) return false;
          return failureCount < 1;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
