/**
 * Concept catalog — bridges the curriculum capability ontology
 * and the global Concept rows.
 *
 * The source of truth for curriculum capabilities is `curriculum.ts`.
 * This module maps a capabilityId (e.g. "js.scope_closures") to a
 * conceptId (e.g. "concept_js_closures"). If a capability declares
 * assessmentTopics, those topics also map.
 *
 * New catalog entries require a migration row — never an ad-hoc id.
 */

const CAPABILITY_TO_CONCEPT: Record<string, string> = {
  "js.variables": "concept_js_variables",
  "js.functions": "concept_js_functions",
  "js.scope_closures": "concept_js_closures",
  "js.this_prototypes": "concept_js_prototypes",
  "js.arrays_objects": "concept_js_arrays",
  "js.async": "concept_js_async",
  "js.modules_tooling": "concept_js_variables", // fallback — modules build on variables mastery
  "js.testing": "concept_js_variables",
  "js.capstone": "concept_js_async",
  "fe.js_foundations": "concept_js_functions",
  "fe.html_css": "concept_fe_html_css",
  "fe.dom_events": "concept_fe_dom",
  "fe.responsive_a11y": "concept_fe_responsive_a11y",
  "fe.async_apis": "concept_fe_async_apis",
  "fe.framework": "concept_fe_framework",
  "fe.state_testing": "concept_fe_framework",
  "fe.capstone": "concept_fe_framework",
  "be.server_foundations": "concept_be_server",
  "be.http_rest": "concept_be_http_rest",
  "be.databases": "concept_be_databases",
  "be.auth": "concept_be_auth",
  "be.testing": "concept_be_auth",
  "be.capstone": "concept_be_databases",
};

const TOPIC_TO_CONCEPT: Record<string, string> = {
  functions: "concept_js_functions",
  scope: "concept_js_scope",
  closures: "concept_js_closures",
  arrays: "concept_js_arrays",
  async: "concept_js_async",
  // fallback for any unlisted topic
};

export function conceptIdForCapability(capabilityId: string): string | null {
  return CAPABILITY_TO_CONCEPT[capabilityId] ?? null;
}

export function conceptIdForTopic(topic: string): string | null {
  return TOPIC_TO_CONCEPT[topic] ?? null;
}

export function conceptIdForLearningUnit(milestoneCapabilityId: string, unitId: string): string | null {
  // Prefer capability mapping; otherwise try to infer from unitId slug
  const direct = conceptIdForCapability(milestoneCapabilityId);
  if (direct) return direct;
  // unitId like unit_js.scope_closures_learn → extract capability part
  const match = unitId.match(/unit_(.+?)_(learn|practice|build|review|reflect|assess)/);
  if (match) return conceptIdForCapability(match[1] ?? "") ?? null;
  return null;
}

export function allConceptIds(): string[] {
  return [...new Set([...Object.values(CAPABILITY_TO_CONCEPT), ...Object.values(TOPIC_TO_CONCEPT)])];
}
