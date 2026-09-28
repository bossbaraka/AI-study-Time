/**
 * Shared harness for HTTP route integration tests.
 *
 * These suites exercise the real route handlers, the real `withStudent`
 * gate, the real error funnel and real PostgreSQL. The ONE thing replaced is
 * session resolution: standing up a real authenticated session for every test
 * would mean exercising scrypt, cookies and the sessions table to test
 * something else entirely.
 *
 * Keeping the fake in one module matters. Three copies of a fake gateway drift
 * independently, and a suite whose fake is subtly more permissive than
 * production will happily pass while ownership is broken.
 *
 * `vi.mock` factories are hoisted per test file, so each suite wires the mock
 * itself — but every one of them delegates to `createGatewayModule()` below.
 */

import { prisma } from "@/lib/server/db";

/** token → signed-in identity. The test's stand-in for the sessions table. */
export const sessions = new Map<string, { id: string; role: string }>();

/** The cookie the mocked `next/headers` will hand back. */
export const cookieJar: { token: string | undefined } = { token: undefined };

const ORIGIN = "https://mureeh.test";

export function signInAs(token: string | undefined): void {
  cookieJar.token = token;
}

/**
 * The object `vi.mock("@/lib/server/auth/gateway", ...)` should return.
 *
 * `actual` must be spread in: `request.ts` imports `AuthGatewayError` and
 * `SESSION_TTL_SEC` from the same module, and replacing it wholesale makes
 * those exports undefined at the point the error funnel needs them.
 */
export function createGatewayModule(actual: Record<string, unknown>) {
  const realFactory = actual.createGateway as (client: typeof prisma) => Record<string, unknown>;
  const realGateway = realFactory(prisma);
  return {
    ...actual,
    createGateway: () => ({
      ...realGateway,
      async resolveSession(rawToken: string | undefined) {
        const entry = rawToken ? sessions.get(rawToken) : undefined;
        if (!entry) return { status: "unauthenticated", session: null, expired: false };
        return {
          status: "authenticated",
          expired: false,
          session: {
            issuedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
            user: {
              id: entry.id,
              name: entry.id,
              email: `${entry.id}@routes.test`,
              role: entry.role,
              emailVerification: { status: "verified", verifiedAt: null },
              onboarding: { status: "completed", completedAt: null },
            },
          },
        };
      },
    }),
  };
}

/** The object `vi.mock("next/headers", ...)` should return. */
export function createHeadersModule() {
  return {
    cookies: async () => ({
      get: (name: string) =>
        name === "mureeh_session" && cookieJar.token ? { value: cookieJar.token } : undefined,
    }),
  };
}

/**
 * Creates the `User` rows a suite needs.
 *
 * Not optional: every learning aggregate carries a foreign key to `User`, so
 * a route that persists anything will fail without them. Doing it here rather
 * than per test keeps suites from depending on each other's leftovers.
 */
export async function seedUsers(...ids: string[]): Promise<void> {
  for (const id of ids) {
    await prisma.user.upsert({
      where: { id },
      create: {
        id,
        email: `${id}@routes.test`,
        passwordHash: "x",
        name: id,
        role: id.startsWith("guardian") ? "guardian" : "student",
        status: "active",
      },
      update: {},
    });
  }
}

type Handler = (req: Request, ctx: never) => Promise<Response>;

/** Invokes a route handler the way Next.js would. */
export function callRoute(handler: Handler, init?: RequestInit, path = "/api/test"): Promise<Response> {
  return handler(new Request(`${ORIGIN}${path}`, init), {} as never);
}

/** A JSON request body with a same-site Origin, so CSRF is not what fails. */
export function jsonInit(body: unknown, method: "POST" | "PATCH" = "POST"): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json", origin: ORIGIN, host: "mureeh.test" },
    body: JSON.stringify(body),
  };
}

/** A request with no body at all — for transitions that take none. */
export function bareInit(method: "POST" = "POST"): RequestInit {
  return { method, headers: { origin: ORIGIN, host: "mureeh.test" } };
}

/** The `{ params }` context Next.js passes to a dynamic route. */
export function ctx(key: string, value: string): never {
  return { params: Promise.resolve({ [key]: value }) } as never;
}

export async function bodyOf(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>;
}

export { ORIGIN };
