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

