import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge presence gate — the first door of the official system.
 *
 * This middleware only checks that a session cookie EXISTS so protected
 * portals never render anonymously; validity, role and suspension are
 * resolved against the database by the server layer (request.ts /
 * gateway) — a present-but-stale cookie continues to the real check and
 * is bounced there. The edge never touches the database or tokens.
 */

const SESSION_COOKIE = "mureeh_session";

/** Portal route groups + protected onboarding areas. */
const PROTECTED_PREFIXES = [
  "/app",
  "/admin",
  "/guardian",
  "/goals",
  "/assessment",
  "/roadmap",
] as const;

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  // Always propagate or mint a requestId for observability
  const incomingId = req.headers.get("x-request-id");
  const requestId = incomingId && incomingId.length >= 8 && incomingId.length <= 80
    ? incomingId
    : (typeof crypto !== "undefined" && "randomUUID" in crypto ? (crypto as unknown as { randomUUID: () => string }).randomUUID() : Math.random().toString(36).slice(2, 12));

  const within = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!within) {
    const res = NextResponse.next();
    res.headers.set("x-request-id", requestId);
    return res;
  }

  if (!req.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/sign-in", req.url);
    login.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
    const redirect = NextResponse.redirect(login);
    redirect.headers.set("x-request-id", requestId);
    return redirect;
  }
  const res = NextResponse.next();
  res.headers.set("x-request-id", requestId);
  return res;
}

export const config = {
  matcher: [
    "/app/:path*",
    "/admin/:path*",
    "/guardian/:path*",
    "/goals/:path*",
    "/assessment/:path*",
    "/roadmap/:path*",
  ],
};
