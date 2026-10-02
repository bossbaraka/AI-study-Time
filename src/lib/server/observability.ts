/**
 * Observability — structured logging + request correlation.
 *
 * Every API handler should:
 *   1. Derive or generate a requestId (X-Request-Id header).
 *   2. Call `logInfo`/`logError` with `{ requestId, route, studentId?, durationMs, category }`.
 * No passwords, tokens, cookies or raw secrets are ever logged.
 */

export interface LogFields {
  requestId?: string;
  route?: string;
  method?: string;
  studentId?: string;
  durationMs?: number;
  status?: number;
  category?: string;
  level?: string;
  error?: unknown;
  // safe metadata only
  meta?: Record<string, unknown>;
}

function safeJson(fields: LogFields): string {
  // Redact sensitive keys if accidentally passed
  const redactedKeys = new Set(["password", "token", "cookie", "secret", "authorization", "hash"]);
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (redactedKeys.has(k.toLowerCase())) safe[k] = "[redacted]";
    else safe[k] = v;
  }
  return JSON.stringify({ ts: new Date().toISOString(), ...safe });
}

export function logInfo(fields: LogFields): void {
  console.log(safeJson({ level: "info", ...fields }));
}

export function logWarn(fields: LogFields): void {
  console.warn(safeJson({ level: "warn", ...fields }));
}

export function logError(fields: LogFields & { error?: unknown }): void {
  const errMsg =
    fields.error instanceof Error ? fields.error.message : typeof fields.error === "string" ? fields.error : "unknown";
  // Never log stack traces that contain queries or secrets; category is enough
  const { error: _e, ...rest } = fields;
  console.error(safeJson({ level: "error", error: errMsg, ...rest }));
}

export function getRequestId(req: Request): string {
  const header = (req.headers as unknown as { get?: (k: string) => string | null })?.get?.("x-request-id");
  if (header && typeof header === "string" && header.length >= 8 && header.length <= 80) return header;
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return (crypto as unknown as { randomUUID: () => string }).randomUUID();
  } catch { /* fall through */ }
  return Math.random().toString(36).slice(2, 12);
}
