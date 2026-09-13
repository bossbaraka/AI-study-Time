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
  const within = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (!within) return NextResponse.next();

  if (!req.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/sign-in", req.url);
    login.searchParams.set("next", `${pathname}${req.nextUrl.search}`);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
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
