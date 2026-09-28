/**
 * Vitest global setup.
 * - jsdom lacks matchMedia (used indirectly by next-themes): minimal stub.
 * - Every engine's persisted state is reset between tests for isolation.
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
  // One call clears the assessment, goal, roadmap and execution stores —
  // they are wired together by the composition root.
  const { resetAllEngines } = await import("@/services/engines");
  resetAllEngines();
});
