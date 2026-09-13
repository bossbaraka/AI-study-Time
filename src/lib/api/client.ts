/**
 * API client — the single seam between the frontend and any backend.
 *
 * Today it resolves against the typed mock layer. Swapping in the real
 * REST/Supabase backend means changing `USE_MOCK` and implementing
 * `httpRequest`; no component, hook or service signature changes.
 */

import { appConfig } from "@/config/site";

export const USE_MOCK = true;

/**
 * AUTH GATEWAY MODE.
 *
 * Authentication runs against the real server-side gateway
 * (Prisma + sessions + httpOnly cookies) in the running application.
 * Unit tests keep the isolated mock backend so component behavior and
 * the demo flows remain hermetic. One switch, nothing else changes.
 */
export const AUTH_USE_GATEWAY = !process.env.VITEST;

/**
 * Optional public API base URL. Only browser-safe, non-secret values may
 * live in `NEXT_PUBLIC_*` variables (see `.env.example`).
 */
export const API_BASE_URL: string = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Auth-specific error carrying a stable, non-sensitive domain code. */
export class AuthApiError extends ApiError {
  constructor(
    readonly authCode: import("@/types/auth").AuthErrorCode,
    status: number,
    message = authCode,
  ) {
    super(message, status, authCode);
    this.name = "AuthApiError";
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

/** Real HTTP transport, used once `USE_MOCK` is false. */
export async function httpRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers: { "Content-Type": "application/json" },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
      credentials: "include",
    });
  } catch (error) {
    // Network-level failure (offline, DNS, CORS): normalized, never raw.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("network", 0, "network");
  }

  if (!response.ok) {
    let code: string | undefined;
    try {
      const payload = (await response.json()) as { code?: string };
      code = payload.code;
    } catch {
      // Non-JSON error body: fall back to status-only error.
    }
    throw new ApiError(`Request failed: ${path}`, response.status, code);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function randomLatency(): number {
  // Zero latency under Vitest keeps tests fast and deterministic.
  if (process.env.VITEST) return 0;
  const { min, max } = appConfig.mockLatency;
  return min + Math.random() * (max - min);
}

/**
 * Mock transport. Mirrors the shape of `httpRequest` so hooks and services
 * behave identically (async, cancellable, latency-bearing).
 */
export async function mockRequest<T>(
  resolver: () => T | Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, randomLatency());
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });

  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  return resolver();
}

/** Structured deep-ish clone so cached query data is never mutated in place. */
export function clone<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);
}
