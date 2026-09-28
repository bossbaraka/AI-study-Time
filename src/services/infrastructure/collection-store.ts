/**
 * Infrastructure adapters for the persistence ports.
 *
 * Two collection backends, one contract:
 *  - `createMemoryCollection`  — server runtime and tests (Node-safe)
 *  - `createLocalStorageCollection` — the browser mock runtime
 *
 * Neither is reachable from a domain engine directly: engines receive a
 * typed port from `services/ports`, and the composition root picks the
 * backend. This module is the ONLY place in the codebase that mentions
 * `localStorage` for domain state.
 */

export interface Identifiable {
  id: string;
}

export interface CollectionStore<T extends Identifiable> {
  /** Live references — callers may mutate then `upsert` to persist. */
  list(): T[];
  findById(id: string): T | undefined;
  /** Insert or replace by id. */
  upsert(item: T): void;
  /** Test seam: drop every record. */
  clear(): void;
}

/* ------------------------------------------------------------------ */
/* In-memory (server + tests)                                          */
/* ------------------------------------------------------------------ */

export function createMemoryCollection<T extends Identifiable>(): CollectionStore<T> {
  const rows: T[] = [];
  return {
    list: () => rows,
    findById: (id) => rows.find((row) => row.id === id),
    upsert: (item) => {
      const index = rows.findIndex((row) => row.id === item.id);
      if (index === -1) rows.push(item);
      else rows[index] = item;
    },
    clear: () => {
      rows.length = 0;
    },
  };
}

/* ------------------------------------------------------------------ */
/* localStorage (browser mock runtime)                                 */
/* ------------------------------------------------------------------ */

/**
 * Mirrors the pre-port engine behaviour exactly: a lazily parsed memory
 * cache in front of localStorage, so repeated reads inside one operation
 * see the same object references, and every write goes straight through.
 * Storage failures (private mode, quota) degrade to memory-only.
 */
export function createLocalStorageCollection<T extends Identifiable>(
  storageKey: string,
): CollectionStore<T> {
  let cache: T[] | null = null;

  function read(): T[] {
    if (cache !== null) return cache;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        cache = [];
        return cache;
      }
      const parsed = JSON.parse(raw) as T[];
      cache = Array.isArray(parsed) ? parsed : [];
      return cache;
    } catch {
      cache = [];
      return cache;
    }
  }

  function write(rows: T[]): void {
    cache = rows;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(rows));
    } catch {
      // Storage unavailable: memory-only is acceptable for the mock runtime.
    }
  }

  return {
    list: read,
    findById: (id) => read().find((row) => row.id === id),
    upsert: (item) => {
      const rows = read();
      const index = rows.findIndex((row) => row.id === item.id);
      if (index === -1) rows.push(item);
      else rows[index] = item;
      write(rows);
    },
    clear: () => {
      cache = [];
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // Ignore unavailable storage in non-browser contexts.
      }
    },
  };
}
