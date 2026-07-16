// ---------------------------------------------------------------------------
// Server-side, in-memory TTL cache for folder listings (listPrefix results).
// Keyed by `${connId}:${normalizedPrefix}`. Re-opening a folder within the TTL
// skips the S3 ListObjectsV2 call. Shared/global like the app's connection store,
// and resets on process restart. The browse "Reload" button clears an entry to
// force a fresh fetch.
// ---------------------------------------------------------------------------
import type { S3ListResult } from "./s3";

const TTL_MS = 60_000; // 60s — tunable; the reload button bypasses it on demand.
const MAX_ENTRIES = 500; // backstop against unbounded growth.

interface Entry {
  result: S3ListResult;
  expires: number;
}

const cache = new Map<string, Entry>();

export function getList(key: string): S3ListResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expires <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

export function setList(key: string, result: S3ListResult): void {
  const now = Date.now();
  // Sweep expired entries opportunistically.
  for (const [k, v] of cache) {
    if (v.expires <= now) cache.delete(k);
  }
  // Backstop: if still oversized, drop the oldest-inserted entry.
  while (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
  cache.set(key, { result, expires: now + TTL_MS });
}

export function clearList(key: string): void {
  cache.delete(key);
}

export function clearAll(): void {
  cache.clear();
}
