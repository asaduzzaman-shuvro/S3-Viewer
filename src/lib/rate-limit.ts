// Server-only (Node runtime). Brute-force throttle for the login endpoint.
//
// Designed so a CORRECT login is never denied — there is no way for an attacker to
// lock a legitimate user out. Two layers:
//
//   1. Per-client lockout — a hard block after MAX_FAILURES wrong attempts from a
//      single *identified* client (real IP). Applied ONLY when the client can be
//      identified, so a request with no/forged identity can't trip a shared
//      "anonymous" bucket and deny everyone. A client only ever locks *itself* out
//      by guessing wrong; a correct password is checked before the lockout is set.
//
//   2. Global friction delay — once failures across all clients spike past a
//      generous allowance, each attempt is delayed a little (capped). This adds
//      friction to scripted guessing. It is best-effort: it slows sequential
//      attackers but cannot fully stop a highly concurrent, IP-rotating one — for
//      that the real defense is the APP_PASSWORD strength policy. Put a trusted
//      proxy in front so the client IP is reliable, or a shared limiter for
//      multi-node deployments (state here is per-process and resets on restart).

interface Attempt {
  count: number;
  windowStart: number;
  blockedUntil: number;
}

// Per-client failure tracking (identified clients only).
const perClient = new Map<string, Attempt>();
const MAX_CLIENTS = 10_000; // hard cap on map size — bounds memory under key flooding
const MAX_FAILURES = 5; // wrong attempts from one client before lockout
const WINDOW_MS = 15 * 60_000; // window over which a client's failures accumulate
const BLOCK_MS = 15 * 60_000; // lockout duration once tripped

// Global friction layer.
const GLOBAL_WINDOW_MS = 60_000; // rolling 1-minute window
const GLOBAL_FREE = 20; // failures/min before any delay kicks in
const GLOBAL_DELAY_STEP_MS = 250; // added delay per failure beyond the allowance
const GLOBAL_MAX_DELAY_MS = 2_000; // cap so held connections stay short
let globalCount = 0;
let globalWindowStart = 0;

// Prune is throttled (not run on every call) so a flood can't make it O(n) per request.
const PRUNE_INTERVAL_MS = 60_000;
let lastPrune = 0;

function prune(now: number): void {
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;
  for (const [key, a] of perClient) {
    if (a.blockedUntil <= now && now - a.windowStart > WINDOW_MS) perClient.delete(key);
  }
}

function rollGlobal(now: number): void {
  if (now - globalWindowStart > GLOBAL_WINDOW_MS) {
    globalWindowStart = now;
    globalCount = 0;
  }
}

export interface RateLimitResult {
  /** false only for an identified client currently in lockout. */
  allowed: boolean;
  retryAfterSeconds: number;
  /** Caller should await this many ms before processing (global friction). */
  delayMs: number;
}

/**
 * Consult before checking the password. Hard-denies only an identified client that
 * has locked itself out; otherwise returns a (possibly zero) friction delay.
 */
export function checkLoginRate(clientId: string | null, now = Date.now()): RateLimitResult {
  if (clientId) {
    const a = perClient.get(clientId);
    if (a && a.blockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((a.blockedUntil - now) / 1000),
        delayMs: 0,
      };
    }
  }
  rollGlobal(now);
  const over = Math.max(0, globalCount - GLOBAL_FREE);
  const delayMs = Math.min(over * GLOBAL_DELAY_STEP_MS, GLOBAL_MAX_DELAY_MS);
  return { allowed: true, retryAfterSeconds: 0, delayMs };
}

/** Record a failed attempt (wrong password). Updates the global and per-client counters. */
export function recordLoginFailure(clientId: string | null, now = Date.now()): void {
  prune(now);
  rollGlobal(now);
  globalCount += 1;

  if (!clientId) return; // never hard-track unidentified clients (no lockout DoS)

  const a = perClient.get(clientId);
  if (!a || now - a.windowStart > WINDOW_MS) {
    // New/expired entry. Respect the size cap so key-flooding can't grow the map.
    if (!a && perClient.size >= MAX_CLIENTS) return;
    perClient.set(clientId, { count: 1, windowStart: now, blockedUntil: 0 });
    return;
  }
  a.count += 1;
  if (a.count >= MAX_FAILURES) a.blockedUntil = now + BLOCK_MS;
}

/** Clear a client's counter after a successful login. */
export function recordLoginSuccess(clientId: string | null): void {
  if (clientId) perClient.delete(clientId);
}
