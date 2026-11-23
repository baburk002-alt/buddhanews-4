import { isIP } from "node:net";
import type { Request } from "express";
import { hashIdentifier } from "./security";

type Bucket = { count: number; resetAt: number };

/**
 * Fixed-window limiter.
 *
 * Two backends share one interface:
 *
 *  - **Memory** (default). Correct for a single container. The map is bounded:
 *    once `MAX_BUCKETS` distinct keys exist, expired entries are evicted and,
 *    if none are expired, the oldest quarter is dropped rather than letting an
 *    attacker exhaust process memory by rotating identifiers.
 *  - **Redis** (`REDIS_URL`). Required when more than one instance serves
 *    traffic, otherwise every instance keeps its own counters and the effective
 *    limit is multiplied by the instance count. Counters are updated by one
 *    atomic Lua script, so concurrent instances cannot race each other.
 *
 * If Redis is configured but unreachable the limiter degrades to the local
 * memory counters (fail-open per instance) instead of turning a cache outage
 * into a full site outage. The failure is logged at most once a minute.
 *
 * Prefer `checkRateLimitAsync` everywhere. `checkRateLimit` is the synchronous,
 * memory-only variant kept for callers that cannot await.
 */
const MAX_BUCKETS = 50_000;
const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function evict(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size >= MAX_BUCKETS) {
    const drop = Math.ceil(buckets.size / 4);
    let removed = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (++removed >= drop) break;
    }
  }
}

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  evict(now);
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/** Synchronous, per-process limiter. */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  cost = 1
): RateLimitResult {
  const now = Date.now();
  sweep(now);
  if (!buckets.has(key) && buckets.size >= MAX_BUCKETS) evict(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: cost, resetAt: now + windowMs });
    return { ok: cost <= limit, remaining: Math.max(0, limit - cost), retryAfterSeconds: 0 };
  }
  if (bucket.count + cost > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  bucket.count += cost;
  return { ok: true, remaining: Math.max(0, limit - bucket.count), retryAfterSeconds: 0 };
}

/* ------------------------------------------------------------------ */
/* Shared store (Redis)                                                */
/* ------------------------------------------------------------------ */

/** Minimal contract so tests (and other stores) can plug in without Redis. */
export interface RateLimitStore {
  /** Atomically add `cost` to `key`; the window starts on the first hit. */
  hit(key: string, windowMs: number, cost: number): Promise<{ count: number; ttlMs: number }>;
  close?(): Promise<void>;
}

const LUA_HIT = `
local count = redis.call('INCRBY', KEYS[1], ARGV[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[2])
  ttl = tonumber(ARGV[2])
end
return {count, ttl}
`;

let store: RateLimitStore | null = null;
let storeKind: "memory" | "redis" | "custom" = "memory";
let storeInitialised = false;
let lastStoreWarning = 0;

function warnStore(error: unknown) {
  const now = Date.now();
  if (now - lastStoreWarning < 60_000) return;
  lastStoreWarning = now;
  console.warn(
    "[RateLimit] Shared store unavailable, using per-instance counters:",
    error instanceof Error ? error.message : "unknown error"
  );
}

async function createRedisStore(url: string): Promise<RateLimitStore> {
  const { default: Redis } = await import("ioredis");
  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2_000,
    commandTimeout: 750,
    retryStrategy: attempt => Math.min(attempt * 200, 5_000),
  });
  client.on("error", warnStore);
  return {
    async hit(key, windowMs, cost) {
      const result = (await client.eval(
        LUA_HIT,
        1,
        `bn:rl:${key}`,
        String(cost),
        String(windowMs)
      )) as [number, number];
      return { count: Number(result[0]), ttlMs: Number(result[1]) };
    },
    async close() {
      client.disconnect();
    },
  };
}

function ensureStore(): RateLimitStore | null {
  if (storeInitialised) return store;
  storeInitialised = true;
  const url = (process.env.REDIS_URL ?? "").trim();
  if (!url) return null;
  // Connected lazily; until it is ready the in-process counters are used.
  void createRedisStore(url)
    .then(created => {
      store = created;
      storeKind = "redis";
      console.log("[RateLimit] Using Redis for shared rate limits");
    })
    .catch(error => warnStore(error));
  return null;
}

/** Install a custom store (tests, or an alternative shared backend). */
export function setRateLimitStore(next: RateLimitStore | null): void {
  storeInitialised = true;
  store = next;
  storeKind = next ? "custom" : "memory";
}

export function rateLimitBackend(): "memory" | "redis" | "custom" {
  ensureStore();
  return storeKind;
}

/** Whether the deployment asked for a shared store (used by the launch check). */
export function sharedRateLimitConfigured(): boolean {
  return Boolean((process.env.REDIS_URL ?? "").trim());
}

/**
 * Preferred limiter. Uses the shared store when one is available and always
 * degrades to the in-process counters if the store errors.
 */
export async function checkRateLimitAsync(
  key: string,
  limit: number,
  windowMs: number,
  cost = 1
): Promise<RateLimitResult> {
  const shared = ensureStore() ?? store;
  if (!shared) return checkRateLimit(key, limit, windowMs, cost);
  try {
    const { count, ttlMs } = await shared.hit(key, windowMs, cost);
    if (count > limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(Math.max(ttlMs, 0) / 1000)),
      };
    }
    return { ok: true, remaining: Math.max(0, limit - count), retryAfterSeconds: 0 };
  } catch (error) {
    warnStore(error);
    return checkRateLimit(key, limit, windowMs, cost);
  }
}

/** Reset helper for tests. */
export function resetRateLimits(): void {
  buckets.clear();
}

export async function closeRateLimitStore(): Promise<void> {
  const current = store;
  store = null;
  storeKind = "memory";
  storeInitialised = false;
  await current?.close?.().catch(() => undefined);
}

/* ------------------------------------------------------------------ */
/* Client identification                                               */
/* ------------------------------------------------------------------ */

/**
 * Canonical client address.
 *
 * Express resolves the trusted proxy hop via `trust proxy`. Reading
 * X-Forwarded-For directly would let a direct client spoof its address and
 * escape both rate limits and the audit trail.
 *
 * Behind an edge that sets a single authoritative header (for example
 * Cloudflare's `CF-Connecting-IP`) set `CLIENT_IP_HEADER` to that header name.
 * Only do this when the origin is reachable exclusively through that edge,
 * because any other client could otherwise send the header itself.
 */
export function clientIp(req: Request): string {
  const headerName = (process.env.CLIENT_IP_HEADER ?? "").trim().toLowerCase();
  if (headerName) {
    const raw = req.headers[headerName];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.split(",")[0]?.trim();
    if (value && isIP(value)) return value.slice(0, 64);
  }
  const ip = req.ip ?? req.socket?.remoteAddress ?? "unknown";
  return ip.replace(/^::ffff:/, "").slice(0, 64);
}

/** Keyed identifier for an address — safe to persist or use as a bucket key. */
export function ipKey(req: Request): string {
  return hashIdentifier(`ip:${clientIp(req)}`);
}

export function userAgent(req: Request): string {
  return String(req.headers["user-agent"] ?? "")
    .replace(/[\u0000-\u001f]/g, " ")
    .slice(0, 300);
}
