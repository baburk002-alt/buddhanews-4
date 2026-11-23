/**
 * Tiny in-process TTL cache for public read paths (story lists, most-read).
 *
 *  - Entries live for `PUBLIC_CACHE_TTL_SECONDS` (default 30, 0 disables).
 *  - Concurrent misses for the same key share one database query
 *    ("single flight"), which is what protects the database during a spike.
 *  - Every editorial mutation calls `invalidatePublicCache()`. A load that
 *    started before an invalidation is never stored, so a slow query cannot
 *    resurrect stale data.
 *  - The cache is per process. With several instances an edit is visible
 *    everywhere after at most one TTL, which is the intended trade-off.
 */
import { getPublicCacheTtlMs } from "./config";

type Entry = { value: unknown; expiresAt: number };

const MAX_ENTRIES = 400;
const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
let generation = 0;

export async function cached<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const ttl = getPublicCacheTtlMs();
  if (ttl <= 0) return loader();
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;
  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;
  const startedIn = generation;
  const promise = loader()
    .then(value => {
      if (startedIn === generation) {
        if (store.size >= MAX_ENTRIES) {
          // Drop the oldest insertion; Map preserves insertion order.
          const oldest = store.keys().next().value;
          if (oldest !== undefined) store.delete(oldest);
        }
        store.set(key, { value, expiresAt: Date.now() + ttl });
      }
      return value;
    })
    .finally(() => {
      if (inflight.get(key) === promise) inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

/** Drop every cached public result. Call after any change to stories or tags. */
export function invalidatePublicCache(): void {
  generation += 1;
  store.clear();
  inflight.clear();
}

export function publicCacheStats() {
  return { entries: store.size, inflight: inflight.size, generation };
}
