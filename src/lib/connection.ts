// Server-only (Node.js runtime). Resolves the "active" S3 connection — the bucket +
// credentials the app should currently browse. Precedence: an encrypted httpOnly
// cookie (runtime-entered connections) overrides the env-provided default.
//
// Do NOT import this from middleware (Edge runtime) — it uses Node's `crypto` and the
// async cookie store.
import { cookies } from "next/headers";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";

export const CONNECTION_COOKIE = "s3v_conn";

// Implicit, non-removable id for the connection built from environment variables.
export const ENV_CONNECTION_ID = "env";

// Keep the encrypted cookie comfortably under the ~4KB browser limit.
export const MAX_SAVED_CONNECTIONS = 10;

export interface S3Connection {
  id: string;
  label: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface ConnectionStore {
  activeId: string;
  items: S3Connection[];
}

// ---------------------------------------------------------------------------
// Env-provided default connection
// ---------------------------------------------------------------------------

/** The connection built from env vars, or null if any required value is missing. */
export function envConnection(): S3Connection | null {
  const region = process.env.AWS_REGION;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !bucket || !accessKeyId || !secretAccessKey) return null;

  return {
    id: ENV_CONNECTION_ID,
    label: `${bucket} (default)`,
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
  };
}

export function hasEnvConnection(): boolean {
  return envConnection() !== null;
}

// ---------------------------------------------------------------------------
// Encryption — AES-256-GCM with a key derived from APP_SECRET.
// Payload format: base64( iv(12) | authTag(16) | ciphertext ).
// ---------------------------------------------------------------------------

function encryptionKey(): Buffer {
  const secret = process.env.APP_SECRET ?? "fallback-secret";
  // sha256 yields a stable 32-byte key regardless of secret length.
  return createHash("sha256").update(secret).digest();
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decrypt(payload: string): string | null {
  try {
    const raw = Buffer.from(payload, "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    // Tampered, wrong key (rotated APP_SECRET), or malformed — treat as no store.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie-backed connection store (read here; writes happen in route handlers)
// ---------------------------------------------------------------------------

/** Read & decrypt the saved connection store, or null if absent/invalid. */
export async function readStore(): Promise<ConnectionStore | null> {
  const store = await cookies();
  const raw = store.get(CONNECTION_COOKIE)?.value;
  if (!raw) return null;

  const json = decrypt(raw);
  if (!json) return null;

  try {
    const parsed = JSON.parse(json) as ConnectionStore;
    if (!parsed || !Array.isArray(parsed.items)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Resolve the active connection. Precedence: the store's active item (if the cookie
 * exists and points at a valid runtime item), else the env default, else null.
 */
export async function getActiveConnection(): Promise<S3Connection | null> {
  const store = await readStore();

  if (store) {
    if (store.activeId === ENV_CONNECTION_ID) {
      return envConnection();
    }
    const active = store.items.find((c) => c.id === store.activeId);
    if (active) return active;
  }

  return envConnection();
}
