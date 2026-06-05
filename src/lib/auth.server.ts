// Server-only (Node.js runtime). Do NOT import this from middleware.
import { timingSafeEqual } from "crypto";

/**
 * Constant-time password comparison — prevents timing attacks.
 * Only safe to call from API routes (Node.js runtime, not Edge).
 */
export function verifyPassword(input: string): boolean {
  const expected = process.env.APP_PASSWORD ?? "";
  if (input.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(input), Buffer.from(expected));
  } catch {
    return false;
  }
}
