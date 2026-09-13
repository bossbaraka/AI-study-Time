/**
 * Vitest global setup.
 * - jsdom lacks matchMedia (used indirectly by next-themes): minimal stub.
 * - Mock auth backend is reset between tests for isolation.
 */

import { afterEach } from "vitest";

if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

afterEach(async () => {
  const { mockAuthBackend } = await import("@/services/auth/mock-auth-backend");
  mockAuthBackend.__reset();
  const { mockAssessmentEngine } = await import("@/services/assessment/mock-assessment-engine");
  mockAssessmentEngine.__reset();
  const { mockGoalEngine } = await import("@/services/goals/mock-goal-engine");
  mockGoalEngine.__reset();
  const { mockRoadmapEngine } = await import("@/services/roadmap/mock-roadmap-engine");
  mockRoadmapEngine.__reset();
  const { mockExecutionEngine } = await import("@/services/execution/mock-execution-engine");
  mockExecutionEngine.__reset();
});
