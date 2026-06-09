// Server-only (Node runtime). In-memory brute-force throttle for the login
// endpoint. State is per-process — adequate for the single-node deployment this
// app targets — and resets on restart. Behind multiple instances, put a shared
// limiter (e.g. Redis) in front instead.

interface Attempt {
  count: number;
  windowStart: number;
  blockedUntil: number;
}

const attempts = new Map<string, Attempt>();

const MAX_ATTEMPTS = 5; // failed attempts allowed per window before lockout
const WINDOW_MS = 15 * 60_000; // window over which failures accumulate
const BLOCK_MS = 15 * 60_000; // lockout duration once the threshold trips

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/** Drop stale entries so the map can't grow unbounded. */
function prune(now: number): void {
  for (const [key, a] of attempts) {
    if (a.blockedUntil <= now && now - a.windowStart > WINDOW_MS) {
      attempts.delete(key);
    }
  }
}

/** Call before checking the password. Denies once a key is in lockout. */
export function checkLoginRate(key: string, now = Date.now()): RateLimitResult {
  const a = attempts.get(key);
  if (a && a.blockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((a.blockedUntil - now) / 1000) };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Record a failed attempt; trips a lockout once the threshold is crossed. */
export function recordLoginFailure(key: string, now = Date.now()): void {
  prune(now);
  const a = attempts.get(key);
  if (!a || now - a.windowStart > WINDOW_MS) {
    attempts.set(key, { count: 1, windowStart: now, blockedUntil: 0 });
    return;
  }
  a.count += 1;
  if (a.count >= MAX_ATTEMPTS) a.blockedUntil = now + BLOCK_MS;
}

/** Clear the counter for a key after a successful login. */
export function recordLoginSuccess(key: string): void {
  attempts.delete(key);
}
