// Server-only (Node.js runtime). Do NOT import this from middleware.
import { timingSafeEqual, createHash } from "crypto";

// APP_PASSWORD policy: at least 8 characters, with at least one number and one letter.
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_POLICY = `APP_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters and contain at least one number and one letter.`;

let validatedPassword: string | null = null;

/** The configured login password, validated against the strength policy (once per process). */
export function getAppPassword(): string {
  if (validatedPassword) return validatedPassword;

  const password = process.env.APP_PASSWORD;
  if (!password) {
    throw new Error(`APP_PASSWORD must be set. ${PASSWORD_POLICY}`);
  }

  const unmet: string[] = [];
  if (password.length < MIN_PASSWORD_LENGTH) {
    unmet.push(`be at least ${MIN_PASSWORD_LENGTH} characters (got ${password.length})`);
  }
  if (!/[0-9]/.test(password)) unmet.push("contain at least one number");
  if (!/[A-Za-z]/.test(password)) unmet.push("contain at least one letter");

  if (unmet.length > 0) {
    throw new Error(`APP_PASSWORD does not meet the password policy — it must ${unmet.join("; ")}. ${PASSWORD_POLICY}`);
  }

  validatedPassword = password; // memoize: validate once per process
  return password;
}

/**
 * Constant-time password comparison — prevents timing attacks.
 * Both inputs are hashed to a fixed 32 bytes first, so the comparison neither
 * short-circuits on a length mismatch nor leaks the expected password's length.
 * Throws if APP_PASSWORD is unset or fails the strength policy.
 * Only safe to call from API routes (Node.js runtime, not Edge).
 */
export function verifyPassword(input: string): boolean {
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(getAppPassword()).digest();
  return timingSafeEqual(a, b);
}
