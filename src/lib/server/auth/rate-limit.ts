/**
 * In-memory sliding-window rate limiter.
 *
 * Honest limitation: single-instance only — a multi-server deployment
 * moves this to Redis behind the same two functions. The limiter is a
 * defense-in-depth layer; the per-account lockout lives in the database.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateResult {
  ok: boolean;
  retryAfterSec: number;
}

export function checkRate(
  key: string,
  limit = 8,
  windowMs = 10 * 60 * 1000,
): RateResult {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

export function resetRate(key: string): void {
  buckets.delete(key);
}

/** Test seam only. */
export function __clearRateBuckets(): void {
  buckets.clear();
}
