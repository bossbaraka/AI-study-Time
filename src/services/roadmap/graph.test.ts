/**
 * Prerequisite-graph utilities (§12): deterministic topological order and
 * hostile cycle detection.
 */

import { describe, expect, it } from "vitest";
import {
  DependencyCycleError,
  hasCycle,
  topologicalSort,
  type GraphEdge,
} from "@/services/roadmap/graph";

const e = (from: string, to: string): GraphEdge => ({ from, to });

describe("topologicalSort", () => {
  it("orders prerequisites before dependents (linear chain)", () => {
    const order = topologicalSort(
      ["c", "b", "a"],
      [e("b", "a"), e("c", "b")],
    );
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("c"));
  });

  it("resolves diamonds: every prerequisite precedes its dependent", () => {
    const order = topologicalSort(
      ["d", "c", "b", "a"],
      [e("c", "a"), e("b", "a"), e("d", "b"), e("d", "c")],
    );
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("b"));
    expect(order.indexOf("a")).toBeLessThan(order.indexOf("c"));
    expect(order.indexOf("b")).toBeLessThan(order.indexOf("d"));
    expect(order.indexOf("c")).toBeLessThan(order.indexOf("d"));
  });

  it("is deterministic: node declaration order breaks ties", () => {
    const nodes = ["x", "y", "z"];
    expect(topologicalSort(nodes, [])).toEqual(["x", "y", "z"]);
    expect(topologicalSort(nodes, [])).toEqual(topologicalSort(nodes, []));
  });

  it("ignores edges referencing unknown nodes", () => {
    expect(topologicalSort(["a"], [e("a", "ghost")])).toEqual(["a"]);
  });

  it("throws DependencyCycleError on a cycle", () => {
    expect(() => topologicalSort(["a", "b"], [e("a", "b"), e("b", "a")])).toThrow(
      DependencyCycleError,
    );
  });

  it("throws on a self-loop", () => {
    expect(() => topologicalSort(["a"], [e("a", "a")])).toThrow(DependencyCycleError);
  });

  it("throws on a long indirect cycle", () => {
    expect(() =>
      topologicalSort(["a", "b", "c"], [e("a", "b"), e("b", "c"), e("c", "a")]),
    ).toThrow(DependencyCycleError);
  });
});

describe("hasCycle", () => {
  it("detects cycles without throwing", () => {
    expect(hasCycle(["a", "b"], [e("a", "b"), e("b", "a")])).toBe(true);
    expect(hasCycle(["a", "b"], [e("a", "b")])).toBe(false);
    expect(hasCycle(["a"], [e("a", "a")])).toBe(true);
  });
});
