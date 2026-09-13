/**
 * Assessment routes and navigation contracts.
 * `goalDiscovery` is the STEP 5 hand-off point: the results screen leads
 * there, but Goal Discovery itself is NOT implemented in STEP 4.
 */
export const ASSESSMENT_ROUTES = {
  intro: "/assessment",
  session: (sessionId: string) => `/assessment/session/${sessionId}`,
  results: (sessionId: string) => `/assessment/results/${sessionId}`,
  goalDiscovery: "/goals",
} as const;

/** i18n key namespace for engine-owned topic identifiers. */
export const TOPIC_KEY_PREFIX = "assessment.topics.";

/** i18n key namespace for qualitative insight codes. */
export const INSIGHT_KEY_PREFIX = "assessment.insights.";
