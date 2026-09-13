import { describe, expect, it } from "vitest";
import { hashPassword, TIMING_DEFENDER_HASH, verifyPassword } from "./password";
import { checkRate, resetRate, __clearRateBuckets } from "./rate-limit";

describe("password hashing (scrypt)", () => {
  it("round-trips a correct password", () => {
    const stored = hashPassword("securePass1");
    expect(stored.startsWith("s2$16384$")).toBe(true);
    expect(verifyPassword("securePass1", stored)).toBe(true);
  });

  it("rejects wrong passwords and malformed stored values", () => {
    const stored = hashPassword("securePass1");
    expect(verifyPassword("SecurePass1", stored)).toBe(false);
    expect(verifyPassword("securePass1", "plaintext")).toBe(false);
    expect(verifyPassword("securePass1", "s2$nope$aa$bb")).toBe(false);
  });

  it("salts: the same password hashes differently each time", () => {
    expect(hashPassword("same12345")).not.toBe(hashPassword("same12345"));
  });

  it("the timing defender is a real hash that never matches user input", () => {
    expect(TIMING_DEFENDER_HASH.startsWith("s2$")).toBe(true);
    expect(verifyPassword("anything", TIMING_DEFENDER_HASH)).toBe(false);
  });
});

describe("rate limiter", () => {
  it("allows up to the limit then blocks with a retry window", () => {
    __clearRateBuckets();
    for (let i = 0; i < 8; i += 1) {
      expect(checkRate("k", 8, 60_000).ok).toBe(true);
    }
    const blocked = checkRate("k", 8, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("reset clears the bucket", () => {
    __clearRateBuckets();
    checkRate("k2", 1, 60_000);
    expect(checkRate("k2", 1, 60_000).ok).toBe(false);
    resetRate("k2");
    expect(checkRate("k2", 1, 60_000).ok).toBe(true);
  });
});
