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
  randomUUID,
} from "crypto";
import { getAppSecret } from "./auth";

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

/** A connection safe to send to the client — never includes the secret key. */
export interface SanitizedConnection {
  id: string;
  label: string;
  bucket: string;
  region: string;
  isEnv: boolean;
  isActive: boolean;
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
  // sha256 yields a stable 32-byte key regardless of secret length.
  return createHash("sha256").update(getAppSecret()).digest();
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

/** Encrypt and persist the store to the httpOnly cookie. Route handlers only. */
export async function writeStore(store: ConnectionStore): Promise<void> {
  const c = await cookies();
  c.set(CONNECTION_COOKIE, encrypt(JSON.stringify(store)), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
}

/** Remove the saved-connection cookie (reverts to env default / unconfigured). */
export async function clearStore(): Promise<void> {
  const c = await cookies();
  c.set(CONNECTION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Add a new runtime connection, make it active, and persist. Returns the saved item.
 * Throws if the saved-connection limit is reached.
 */
export async function addConnection(
  input: Omit<S3Connection, "id">
): Promise<S3Connection> {
  const store = (await readStore()) ?? { activeId: ENV_CONNECTION_ID, items: [] };
  if (store.items.length >= MAX_SAVED_CONNECTIONS) {
    throw new Error(
      `You can save at most ${MAX_SAVED_CONNECTIONS} connections. Remove one first.`
    );
  }
  const item: S3Connection = { ...input, id: randomUUID() };
  store.items.push(item);
  store.activeId = item.id;
  await writeStore(store);
  return item;
}

/** The id that actually resolves as active (mirrors getActiveConnection's precedence). */
async function effectiveActiveId(): Promise<string | null> {
  const store = await readStore();
  if (store) {
    if (store.activeId === ENV_CONNECTION_ID && envConnection()) {
      return ENV_CONNECTION_ID;
    }
    if (store.items.some((c) => c.id === store.activeId)) {
      return store.activeId;
    }
  }
  return envConnection() ? ENV_CONNECTION_ID : null;
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

function sanitize(conn: S3Connection, isActive: boolean): SanitizedConnection {
  return {
    id: conn.id,
    label: conn.label,
    bucket: conn.bucket,
    region: conn.region,
    isEnv: conn.id === ENV_CONNECTION_ID,
    isActive,
  };
}

/** Sanitized list for the client: env default (if any) first, then saved items. */
export async function listConnections(): Promise<SanitizedConnection[]> {
  const store = await readStore();
  const env = envConnection();
  const activeId = await effectiveActiveId();

  const out: SanitizedConnection[] = [];
  if (env) out.push(sanitize(env, env.id === activeId));
  if (store) {
    for (const item of store.items) out.push(sanitize(item, item.id === activeId));
  }
  return out;
}

/** Make an existing connection (env or saved) the active one. */
export async function setActiveConnection(id: string): Promise<void> {
  const store = (await readStore()) ?? { activeId: ENV_CONNECTION_ID, items: [] };
  const exists =
    id === ENV_CONNECTION_ID ? !!envConnection() : store.items.some((c) => c.id === id);
  if (!exists) throw new Error("Unknown connection.");
  store.activeId = id;
  await writeStore(store);
}

/** Remove a saved connection (never the env default); re-point active if needed. */
export async function removeConnection(id: string): Promise<void> {
  if (id === ENV_CONNECTION_ID) {
    throw new Error("The default connection can't be removed.");
  }
  const store = await readStore();
  if (!store) return;

  store.items = store.items.filter((c) => c.id !== id);
  if (store.activeId === id) {
    store.activeId = envConnection()
      ? ENV_CONNECTION_ID
      : store.items[0]?.id ?? ENV_CONNECTION_ID;
  }
  await writeStore(store);
}
