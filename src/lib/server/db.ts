/**
 * Server-only database access.
 *
 * Lazy-initialised so that `next build` can collect page data without a
 * live DATABASE_URL or a generated Prisma client. The first real request
 * that touches `prisma.user` (or any other model) will trigger either a
 * proper client or an explicit error — a missing connection string must
 * never degrade into a silently working in-memory store.
 *
 * This is the ONLY place a `PrismaClient` is constructed.
 */
// Type-only import — never pulls the runtime engine at bundle time.
import type { PrismaClient as PrismaClientType } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  mureehPrisma?: PrismaClientType;
};

let _prisma: PrismaClientType | undefined = globalForPrisma.mureehPrisma;

function createClient(): PrismaClientType {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. The application requires PostgreSQL; it will not fall back to mock persistence.",
    );
  }
  // Runtime import deferred so that `next build` without `prisma generate`
  // can still import this module (it only fails on first use).
  let PrismaClient: new (args: unknown) => PrismaClientType;
  let PrismaPg: new (args: unknown) => unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    PrismaClient = require("@prisma/client").PrismaClient as new (args: unknown) => PrismaClientType;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    PrismaPg = require("@prisma/adapter-pg").PrismaPg as new (args: unknown) => unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `@prisma/client did not initialize yet. Please run "prisma generate" and try again. Underlying: ${msg}`,
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (PrismaClient as any)({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapter: new (PrismaPg as any)({ connectionString }),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  }) as PrismaClientType;
}

function ensurePrisma(): PrismaClientType {
  if (_prisma) return _prisma;
  if (globalForPrisma.mureehPrisma) {
    _prisma = globalForPrisma.mureehPrisma;
    return _prisma;
  }
  _prisma = createClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.mureehPrisma = _prisma;
  return _prisma;
}

/**
 * Lazily-proxied Prisma client. Accessing any property triggers
 * `ensurePrisma()` so top-level imports never throw during `next build`.
 */
// The proxy targets an empty object; every trap delegates to `ensurePrisma()`.
export const prisma = new Proxy({} as PrismaClientType, {
  get(_target, prop, _receiver) {
    const client = ensurePrisma();
    const value = (client as unknown as Record<PropertyKey, unknown>)[prop];
    if (typeof value === "function") return (value as (...a: unknown[]) => unknown).bind(client);
    return value;
  },
  // Make `await prisma.$connect()` and similar work when Node checks for `then`.
  has(_target, prop) {
    const client = ensurePrisma();
    return prop in (client as object);
  },
  // `Object.prototype.toString` / `util.inspect` should still delegate.
  getOwnPropertyDescriptor(_target, prop) {
    const client = ensurePrisma();
    const desc = Object.getOwnPropertyDescriptor(client as object, prop);
    if (desc) return desc;
    return undefined;
  },
});
