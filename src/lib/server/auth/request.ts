/**
 * Next.js glue for the auth gateway: cookies, request metadata,
 * error-to-JSON mapping and the admin gate. Route handlers and the
 * admin server layout go through here — nothing else touches cookies.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/server/db";
import { ApiError } from "@/lib/api/client";
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

export async function errorResponse(error: unknown): Promise<NextResponse> {
  if (error instanceof AuthGatewayError) {
    return NextResponse.json({ code: error.code }, { status: error.status });
  }
  // Domain engines throw `ApiError` carrying a stable, non-sensitive code
  // and the HTTP status it maps to. The message is never forwarded — only
  // the code crosses the boundary.
  if (error instanceof ApiError) {
    const status = error.status >= 400 && error.status <= 599 ? error.status : 500;
    return NextResponse.json({ code: error.code ?? "unknown" }, { status });
  }
  // Anything else is an internal failure: log server-side, never forward.
  console.error("[auth-gateway] unexpected error:", error instanceof Error ? error.name : error);
  return NextResponse.json({ code: "unknown" }, { status: 500 });
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
  try {
    const admin = await requireAdminApi();
    return await fn(admin);
  } catch (error) {
    return await errorResponse(error);
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
  try {
    const student = await requireStudentApi();
    return await fn(student);
  } catch (error) {
    return await errorResponse(error);
  }
}
