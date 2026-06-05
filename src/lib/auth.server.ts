// Server-only (Node.js runtime). Do NOT import this from middleware.
import { timingSafeEqual, createHash } from "crypto";

/**
 * Constant-time password comparison — prevents timing attacks.
 * Both inputs are hashed to a fixed 32 bytes first, so the comparison neither
 * short-circuits on a length mismatch nor leaks the expected password's length.
 * Only safe to call from API routes (Node.js runtime, not Edge).
 */
export function verifyPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD ?? "";
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
