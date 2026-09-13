/**
 * Pure prerequisite-graph utilities (Kahn topological sort).
 * No React, no storage — independently testable, cycle-hostile (§12).
 */

export class DependencyCycleError extends Error {
  constructor(readonly involved: readonly string[]) {
    super(`Dependency cycle detected: ${involved.join(" → ")}`);
    this.name = "DependencyCycleError";
  }
}

export interface GraphEdge {
  /** Node that depends. */
  from: string;
  /** Prerequisite node. */
  to: string;
}

/** True when the edge set contains any cycle (self-loops included). */
export function hasCycle(nodes: readonly string[], edges: readonly GraphEdge[]): boolean {
  try {
    topologicalSort(nodes, edges);
    return false;
  } catch {
    return true;
  }
}

/**
 * Deterministic topological order: prerequisites first. Ties are broken by
 * the caller's `nodes` order (insertion order), so the same input always
 * yields the same output. Throws `DependencyCycleError` when the graph
 * cannot be fully ordered.
 */
export function topologicalSort(
  nodes: readonly string[],
  edges: readonly GraphEdge[],
): string[] {
  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const node of nodes) {
    indegree.set(node, 0);
    outgoing.set(node, []);
  }
  for (const edge of edges) {
    if (!indegree.has(edge.from) || !indegree.has(edge.to)) continue;
    if (edge.from === edge.to) {
      throw new DependencyCycleError([edge.from, edge.to]);
    }
    // from depends on to ⇒ `to` must come first.
    outgoing.get(edge.to)!.push(edge.from);
    indegree.set(edge.from, (indegree.get(edge.from) ?? 0) + 1);
  }

  const ready = nodes.filter((node) => (indegree.get(node) ?? 0) === 0);
  const order: string[] = [];
  while (ready.length > 0) {
    const node = ready.shift()!;
    order.push(node);
    for (const dependent of outgoing.get(node) ?? []) {
      const next = (indegree.get(dependent) ?? 1) - 1;
      indegree.set(dependent, next);
      if (next === 0) ready.push(dependent);
    }
  }

  if (order.length !== nodes.length) {
    const stuck = nodes.filter((node) => !order.includes(node));
    throw new DependencyCycleError(stuck);
  }
  return order;
}
