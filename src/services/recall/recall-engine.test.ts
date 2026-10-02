import { describe, it, expect } from "vitest";
import { createRecallEngine } from "./recall-engine";

describe("recall engine", () => {
  it("schedules new card due tomorrow with ease 2.5", () => {
    const engine = createRecallEngine();
    const s = engine.scheduleNew("stu_1", "concept_js_closures");
    expect(s.intervalDays).toBe(1);
    expect(s.easeFactor).toBeCloseTo(2.5);
    expect(s.state).toBe("new");
    const dueIn = engine.dueInDays(s);
    expect(dueIn).toBeLessThanOrEqual(1);
    expect(dueIn).toBeGreaterThanOrEqual(0);
  });

  it("increases interval on high quality (5)", () => {
    const engine = createRecallEngine();
    let s = engine.scheduleNew("stu_1", "c1");
    s = engine.review(s, { conceptId: "c1", quality: 5 });
    expect(s.intervalDays).toBe(1);
    s = engine.review(s, { conceptId: "c1", quality: 5 });
    expect(s.intervalDays).toBe(3);
    const prevInterval = s.intervalDays;
    s = engine.review(s, { conceptId: "c1", quality: 5 });
    expect(s.intervalDays).toBeGreaterThan(prevInterval);
    expect(s.easeFactor).toBeGreaterThan(2.5);
  });

  it("resets to relearning on low quality (0-2)", () => {
    const engine = createRecallEngine();
    let s = engine.scheduleNew("stu_1", "c1");
    s = engine.review(s, { conceptId: "c1", quality: 5 });
    s = engine.review(s, { conceptId: "c1", quality: 5 });
    // Now failure
    s = engine.review(s, { conceptId: "c1", quality: 1 });
    expect(s.state).toBe("relearning");
    expect(s.intervalDays).toBe(1);
    expect(s.repetitions).toBe(0);
  });

  it("is deterministic: same quality sequence produces same intervals", () => {
    const a = createRecallEngine();
    const b = createRecallEngine();
    let sa = a.scheduleNew("stu", "c");
    let sb = b.scheduleNew("stu", "c");
    for (const q of [5, 4, 5]) {
      sa = a.review(sa, { conceptId: "c", quality: q });
      sb = b.review(sb, { conceptId: "c", quality: q });
    }
    expect(sa.intervalDays).toBe(sb.intervalDays);
    expect(sa.easeFactor).toBe(sb.easeFactor);
  });

  it("clamps easeFactor between 1.3 and 2.8", () => {
    const engine = createRecallEngine();
    let s = engine.scheduleNew("stu", "c");
    for (let i = 0; i < 20; i++) {
      s = engine.review(s, { conceptId: "c", quality: 0 });
    }
    expect(s.easeFactor).toBeGreaterThanOrEqual(1.3);
    expect(s.easeFactor).toBeLessThanOrEqual(2.8);
  });
});
