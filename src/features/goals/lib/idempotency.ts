/**
 * Client-side idempotency keys (§14).
 *
 * A key is generated once per user intent (one discovery submission, one
 * lock confirmation) and reused across retries, so a double click, a
 * failed save, or a re-render can never create duplicate goals or
 * duplicate state transitions in the engine.
 */

export function createIdempotencyKey(prefix: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}.${random}`;
}
