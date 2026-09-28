/**
 * Carries the active Prisma transaction to whichever store method happens to
 * be running inside it.
 *
 * Why not just pass the transaction client down as an argument? Because the
 * port signature is `upsert(aggregate)` — the domain engine that calls it
 * must not know that a database, let alone a transaction, exists. Threading
 * a client through those calls would leak infrastructure into the domain.
 *
 * Why not a mutable field on the store? The stores are module-level
 * singletons shared by every concurrent request, so two overlapping
 * transactions would overwrite each other's client and one request's writes
 * would silently land in another's transaction. `AsyncLocalStorage` is
 * scoped to the running async context instead, so each request sees only
 * its own. It is part of Node's standard library — no new dependency.
 */
import { AsyncLocalStorage } from "node:async_hooks";

import type { PrismaClient, Prisma } from "@prisma/client";

import { PersistenceConflictError } from "@/services/ports/stores";

/** Either the client inside the running transaction, or the shared client. */
export type DbClient = PrismaClient | Prisma.TransactionClient;

const activeTransaction = new AsyncLocalStorage<Prisma.TransactionClient>();

export function currentClient(prisma: PrismaClient): DbClient {
  return activeTransaction.getStore() ?? prisma;
}

/**
 * Runs `work` inside one transaction. A nested call joins the transaction
 * already in flight rather than opening a second one, which Prisma would
 * reject.
 */
export function inTransaction<T>(
  prisma: PrismaClient,
  work: () => Promise<T>,
): Promise<T> {
  if (activeTransaction.getStore()) return work();
  return prisma.$transaction((tx) => activeTransaction.run(tx, work));
}

/** Prisma raises `P2002` when a unique constraint rejects a write. */
export function isUniqueViolation(error: unknown): boolean {
  return codeOf(error) === "P2002";
}

/** Prisma raises `P2025` when an update or delete finds no matching row. */
export function isMissingRow(error: unknown): boolean {
  return codeOf(error) === "P2025";
}

/** Prisma raises `P2003` when a foreign key cannot be satisfied. */
export function isForeignKeyViolation(error: unknown): boolean {
  return codeOf(error) === "P2003";
}

/**
 * Is this a failure to TALK to the database, rather than a refusal by it?
 *
 * The distinction decides the HTTP answer: a constraint violation is the
 * caller's conflict (409), while an unreachable database is our outage
 * (503). Conflating them tells a client to retry something that will never
 * succeed, or to give up on something that would work in a second.
 */
export function isDatabaseUnavailable(error: unknown): boolean {
  const code = codeOf(error);
  // P1001 cannot reach the database · P1002 connection timeout ·
  // P1008 operations timed out · P1017 server closed the connection.
  return code === "P1001" || code === "P1002" || code === "P1008" || code === "P1017";
}

/** A short, loggable label. Never a message, never a query, never a secret. */
export function dbErrorCategory(error: unknown): string {
  if (isDatabaseUnavailable(error)) return "db_unavailable";
  if (isUniqueViolation(error)) return "constraint_duplicate";
  if (isForeignKeyViolation(error)) return "constraint_reference";
  if (isMissingRow(error)) return "not_found";
  if (error instanceof PersistenceConflictError) return `conflict_${error.reason}`;
  return "internal";
}

function codeOf(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Replaces a database driver error with a domain-level one (§28).
 *
 * Nothing above the infrastructure boundary may see `P2002`, a SQLSTATE, a
 * constraint name or a query string: those are implementation detail, and
 * they are also how a database's internal shape ends up in an HTTP response.
 * Callers switch on `reason` and never on a message.
 */
export function translateDbError(error: unknown): unknown {
  if (isUniqueViolation(error)) {
    return new PersistenceConflictError(
      "duplicate_key",
      "a concurrent write claimed the same unique key",
    );
  }
  if (isForeignKeyViolation(error)) {
    return new PersistenceConflictError("invalid_reference", "the referenced record does not exist");
  }
  if (isMissingRow(error)) {
    return new PersistenceConflictError("not_found", "the record was deleted concurrently");
  }
  return error;
}

