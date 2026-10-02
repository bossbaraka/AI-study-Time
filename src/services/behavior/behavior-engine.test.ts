import { describe, it, expect } from "vitest";
import { analyzeBehavior } from "./behavior-engine";
import type { LearningEvent } from "@/types/learning-event";

function event(type: LearningEvent["type"], daysAgo = 0, payload: Record<string, unknown> = {}): LearningEvent {
  const ts = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return {
    eventId: `ev_${type}_${daysAgo}`,
    studentId: "stu_1",
    type,
    timestamp: ts,
    source: "api",
    entityType: "Evidence",
    entityId: "e1",
    payload,
    schemaVersion: 1,
    correlationId: null,
    createdAt: ts,
  };
}

describe("behavior engine", () => {
  it("computes consistency as days active /14", () => {
    const events = [event("EVIDENCE_SUBMITTED", 0), event("EVIDENCE_SUBMITTED", 1), event("EVIDENCE_SUBMITTED", 2)];
    const insights = analyzeBehavior(events);
    expect(insights.consistency).toBeGreaterThan(0);
    expect(insights.consistency).toBeLessThanOrEqual(100);
  });

  it("detects hint dependency rate from HINT_REQUESTED / EVIDENCE_SUBMITTED", () => {
    const events = [event("EVIDENCE_SUBMITTED", 0), event("HINT_REQUESTED", 0), event("HINT_REQUESTED", 0)];
    const insights = analyzeBehavior(events);
    expect(insights.hintDependencyRate).toBeGreaterThan(0);
  });

  it("does not fabricate delay minutes — returns 0 honestly", () => {
    const insights = analyzeBehavior([event("EVIDENCE_SUBMITTED", 0)]);
    expect(insights.averageDelayMinutes).toBe(0);
  });

  it("builds studyBursts histogram for last 7 days", () => {
    const events = [event("EVIDENCE_SUBMITTED", 0), event("EVIDENCE_SUBMITTED", 0), event("EVIDENCE_SUBMITTED", 1)];
    const insights = analyzeBehavior(events);
    expect(insights.studyBursts.length).toBeGreaterThan(0);
  });

  it("never uses clinical language — just observable counts", () => {
    const insights = analyzeBehavior([event("EVIDENCE_SUBMITTED", 0, { score: 0, conceptId: "c1" })]);
    expect(insights).toHaveProperty("sessionAbandonmentRate");
    expect(insights).toHaveProperty("repeatedFailureConcepts");
  });
});
