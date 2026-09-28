/**
 * Next.js glue for the auth gateway: cookies, request metadata,
 * error-to-JSON mapping and the admin gate. Route handlers and the
 * admin server layout go through here — nothing else touches cookies.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { PersistenceConflictError } from "@/services/ports/stores";
import { dbErrorCategory, isDatabaseUnavailable } from "@/services/infrastructure/prisma/context";
import { mapDomainError } from "@/lib/server/domain-errors";
import { AuthGatewayError, createGateway, SESSION_TTL_SEC } from "@/lib/server/auth/gateway";
import type { AuthUser } from "@/types/auth";

export const SESSION_COOKIE = "mureeh_session";

/** The one bound instance for the application runtime. */
export const gateway = createGateway(prisma);

/* ------------------------------------------------------------------ */

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export function requestMeta(req: Request): RequestMeta {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? (forwarded.split(",")[0] ?? "").trim() || null : null;
  return { ip, userAgent: req.headers.get("user-agent") };
}

/**
 * Minimal CSRF defense for cookie-authenticated POSTs: a cross-site form
 * cannot set application/json, and browsers always send Origin on POST.
 */
export function csrfRejected(req: Request): boolean {
  if (req.method === "GET" || req.method === "HEAD") return false;
  const origin = req.headers.get("origin");
  if (!origin) return false; // Non-browser clients (tests, curl) omit it.
  try {
    const originUrl = new URL(origin);
    const hostHeader =
      req.headers.get("x-forwarded-host") ||
      req.headers.get("host") ||
      new URL(req.url).host;

    if (originUrl.host === hostHeader) return false;

    // Allow local development host aliases (localhost, 127.0.0.1, 0.0.0.0)
    const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
    const targetHost = hostHeader.split(":")[0] ?? "";
    const reqHostname = new URL(req.url).hostname;
    if (
      localHosts.has(originUrl.hostname) &&
      (localHosts.has(targetHost) || localHosts.has(reqHostname))
    ) {
      return false;
    }

    return true;
  } catch {
    return true;
  }
}

export function forbiddenResponse(): NextResponse {
  return NextResponse.json({ code: "forbidden" }, { status: 403 });
}

export function invalidRequestResponse(): NextResponse {
  // Generic: validation failures never echo field-level internals.
  return NextResponse.json({ code: "unknown" }, { status: 400 });
}

/** What the failure log needs to be actionable (§29). */
export interface FailureContext {
  operation: string;
  requestId: string;
  userId?: string;
  startedAt: number;
}

export async function errorResponse(
  error: unknown,
  context?: FailureContext,
): Promise<NextResponse> {
  if (error instanceof AuthGatewayError) {
    return NextResponse.json({ code: error.code }, { status: error.status });
  }
  // A rejected write, not a broken server: a concurrent writer claimed the
  // same idempotency key, or the row moved underneath us. Retryable by the
  // client, and never reported as a 500.
  if (error instanceof PersistenceConflictError) {
    logFailure(error, context, 409);
    return NextResponse.json({ code: "conflict" }, { status: 409 });
  }
  // The database is not reachable. Fail explicitly (§25): the client is told
  // the service is unavailable rather than being handed an empty result that
  // looks like "this student has no data".
  if (isDatabaseUnavailable(error)) {
    logFailure(error, context, 503);
    return NextResponse.json({ code: "service_unavailable" }, { status: 503 });
  }
  // Domain errors that already carry their own classification keep it
  // (§12). Only the code crosses the boundary, never a message: the client
  // maps codes to translation keys, and a message could carry internals.
  const mapped = mapDomainError(error);
  if (mapped) {
    if (mapped.status >= 500) logFailure(error, context, mapped.status);
    return NextResponse.json({ code: mapped.code }, { status: mapped.status });
  }
  // Anything else is an internal failure: log server-side, never forward.
  logFailure(error, context, 500);
  return NextResponse.json({ code: "unknown" }, { status: 500 });
}

/**
 * One structured line per failure (§29).
 *
 * Deliberately narrow: the category, never the driver's message. A Prisma
 * error carries the failing query, which carries column names and sometimes
 * the values bound to them — exactly what must not reach a log aggregator.
 */
function logFailure(error: unknown, context: FailureContext | undefined, status: number): void {
  const entry = {
    event: "request_failed",
    status,
    category: dbErrorCategory(error),
    operation: context?.operation ?? "unknown",
    requestId: context?.requestId ?? "unknown",
    userId: context?.userId ?? null,
    durationMs: context ? Math.round(performance.now() - context.startedAt) : null,
  };
  console.error(JSON.stringify(entry));
}

/* ------------------------------------------------------------------ */
/* Session cookie plumbing                                             */
/* ------------------------------------------------------------------ */

export async function readSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

const baseCookie = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
};

export function setSessionCookie(res: NextResponse, token: string, maxAgeSec = SESSION_TTL_SEC): NextResponse {
  res.cookies.set(SESSION_COOKIE, token, { ...baseCookie, maxAge: maxAgeSec });
  return res;
}

export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(SESSION_COOKIE, "", { ...baseCookie, maxAge: 0 });
  return res;
}

/* ------------------------------------------------------------------ */
/* Server-side authorization (the real gate — not the UI guard)       */
/* ------------------------------------------------------------------ */

/** Resolve the signed-in user from the cookie, or null. */
export async function serverUser(): Promise<AuthUser | null> {
  const state = await gateway.resolveSession(await readSessionToken());
  return state.status === "authenticated" ? state.session?.user ?? null : null;
}

/** API gate: returns the admin user or throws a typed 401/403. */
export async function requireAdminApi(): Promise<AuthUser> {
  const user = await serverUser();
  if (!user) throw new AuthGatewayError("session_expired", 401);
  if (user.role !== "admin") throw new AuthGatewayError("forbidden", 403);
  return user;
}

/**
 * API gate: returns the signed-in STUDENT or throws a typed 401/403.
 *
 * This is the ownership anchor for every student-owned resource: handlers
 * receive the id from the session cookie, so a crafted request can never
 * name another student.
 */
export async function requireStudentApi(): Promise<AuthUser> {
  const user = await serverUser();
  if (!user) throw new AuthGatewayError("session_expired", 401);
  if (user.role !== "student") throw new AuthGatewayError("forbidden", 403);
  return user;
}

/**
 * Standard admin route wrapper: CSRF check for writes, real session →
 * role check, typed error funnel. The only place admin handlers begin.
 */
export async function withAdmin(
  req: Request,
  fn: (admin: AuthUser) => Promise<NextResponse>,
): Promise<NextResponse> {
  if (csrfRejected(req)) return forbiddenResponse();
  const context = failureContext(req, "admin");
  try {
    const admin = await requireAdminApi();
    context.userId = admin.id;
    return await fn(admin);
  } catch (error) {
    return await errorResponse(error, context);
  }
}

/**
 * Standard student route wrapper: CSRF check for writes, real session →
 * student role check, typed error funnel. Domain errors thrown by an
 * engine (`ApiError`) are mapped by the caller-supplied `toStatus`.
 */
export async function withStudent(
  req: Request,
  fn: (student: AuthUser) => Promise<NextResponse>,
): Promise<NextResponse> {
  if (csrfRejected(req)) return forbiddenResponse();
  const context = failureContext(req, "student");
  try {
    const student = await requireStudentApi();
    context.userId = student.id;
    return await fn(student);
  } catch (error) {
    return await errorResponse(error, context);
  }
}

function failureContext(req: Request, scope: string): FailureContext {
  return {
    operation: `${scope} ${new URL(req.url).pathname}`,
    requestId: req.headers.get("x-request-id") ?? crypto.randomUUID(),
    startedAt: performance.now(),
  };
}
