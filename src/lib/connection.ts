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
  randomBytes,
  randomUUID,
  scryptSync,
} from "crypto";
import { getAppSecret, COOKIE_SECURE } from "./auth";

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
  // When set, overrides the env-default connection's fields (wins over .env.local
  // until reset). Lets the "default" bucket be edited like any other.
  envOverride?: Omit<S3Connection, "id">;
  // When true, the env-default bucket is hidden (the user deleted it). It otherwise
  // regenerates from the env vars on every request; this persists the deletion.
  // Restorable while the env vars remain set.
  envHidden?: boolean;
}

/** A connection safe to send to the client — never includes the secret key. */
export interface SanitizedConnection {
  id: string;
  label: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  isEnv: boolean;
  isActive: boolean;
  // env-default only: true when an override is active (so the UI can offer "reset").
  isOverridden: boolean;
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

// Derive the 32-byte AES key from APP_SECRET via scrypt (a slow KDF), so even a
// short/weak secret yields a strong key — stretching makes offline brute force
// expensive. Memoized: scrypt is deliberately CPU-heavy, and the secret is constant
// per process, so derive once. (Changing the salt invalidates existing s3v_conn
// cookies — they simply fail to decrypt and fall back to the env default.)
let cachedKey: Buffer | null = null;
function encryptionKey(): Buffer {
  if (!cachedKey) {
    cachedKey = scryptSync(getAppSecret(), "s3v-connection-store-v1", 32);
  }
  return cachedKey;
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
    secure: COOKIE_SECURE,
  });
}

/** Remove the saved-connection cookie (reverts to env default / unconfigured). */
export async function clearStore(): Promise<void> {
  const c = await cookies();
  c.set(CONNECTION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: COOKIE_SECURE,
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

/** The env-default connection, with any saved override applied over the env vars. */
function resolveEnvConnection(store: ConnectionStore | null): S3Connection | null {
  // Deleted by the user — stays hidden until restored, even though the env vars exist.
  if (store?.envHidden) return null;
  if (store?.envOverride) {
    return { id: ENV_CONNECTION_ID, ...store.envOverride };
  }
  return envConnection();
}

/** The id that actually resolves as active (mirrors getActiveConnection's precedence). */
async function effectiveActiveId(): Promise<string | null> {
  const store = await readStore();
  if (store) {
    if (store.activeId === ENV_CONNECTION_ID && resolveEnvConnection(store)) {
      return ENV_CONNECTION_ID;
    }
    if (store.items.some((c) => c.id === store.activeId)) {
      return store.activeId;
    }
  }
  return resolveEnvConnection(store) ? ENV_CONNECTION_ID : null;
}

/**
 * Resolve the active connection. Precedence: the store's active item (if the cookie
 * exists and points at a valid runtime item), else the env default (with override
 * applied), else null.
 */
export async function getActiveConnection(): Promise<S3Connection | null> {
  const store = await readStore();

  if (store) {
    if (store.activeId === ENV_CONNECTION_ID) {
      return resolveEnvConnection(store);
    }
    const active = store.items.find((c) => c.id === store.activeId);
    if (active) return active;
  }

  return resolveEnvConnection(store);
}

function sanitize(
  conn: S3Connection,
  isActive: boolean,
  isOverridden = false
): SanitizedConnection {
  return {
    id: conn.id,
    label: conn.label,
    bucket: conn.bucket,
    region: conn.region,
    accessKeyId: conn.accessKeyId,
    isEnv: conn.id === ENV_CONNECTION_ID,
    isActive,
    isOverridden,
  };
}

/** Sanitized list for the client: env default (if any) first, then saved items. */
export async function listConnections(): Promise<SanitizedConnection[]> {
  const store = await readStore();
  const env = resolveEnvConnection(store);
  const activeId = await effectiveActiveId();

  const out: SanitizedConnection[] = [];
  if (env) out.push(sanitize(env, env.id === activeId, !!store?.envOverride));
  if (store) {
    for (const item of store.items) out.push(sanitize(item, item.id === activeId));
  }
  return out;
}

/** Make an existing connection (env or saved) the active one. */
export async function setActiveConnection(id: string): Promise<void> {
  const store = (await readStore()) ?? { activeId: ENV_CONNECTION_ID, items: [] };
  if (id === ENV_CONNECTION_ID) {
    // The env default exists (and is restorable) whenever the env vars are set —
    // activating it also un-hides it if it had been deleted.
    if (!hasEnvConnection()) throw new Error("Unknown connection.");
    store.envHidden = false;
  } else if (!store.items.some((c) => c.id === id)) {
    throw new Error("Unknown connection.");
  }
  store.activeId = id;
  await writeStore(store);
}

/** True when the env default is configured but currently hidden (deleted) — restorable. */
export async function canRestoreEnvDefault(): Promise<boolean> {
  return hasEnvConnection() && !!(await readStore())?.envHidden;
}

/**
 * Raw connection (incl. secret) for server-side use. For the env default this is the
 * resolved connection (override applied over env vars). Null if it doesn't exist.
 */
export async function getStoredConnection(id: string): Promise<S3Connection | null> {
  const store = await readStore();
  if (id === ENV_CONNECTION_ID) return resolveEnvConnection(store);
  return store?.items.find((c) => c.id === id) ?? null;
}

/**
 * Update a connection's fields and persist; active stays put. For the env default the
 * change is stored as an override that wins over .env.local until reset.
 */
export async function updateConnection(
  id: string,
  fields: Partial<Omit<S3Connection, "id">>
): Promise<void> {
  const store = (await readStore()) ?? { activeId: ENV_CONNECTION_ID, items: [] };

  if (id === ENV_CONNECTION_ID) {
    const base = resolveEnvConnection(store);
    store.envOverride = {
      label: fields.label ?? base?.label ?? "",
      region: fields.region ?? base?.region ?? "",
      bucket: fields.bucket ?? base?.bucket ?? "",
      accessKeyId: fields.accessKeyId ?? base?.accessKeyId ?? "",
      secretAccessKey: fields.secretAccessKey ?? base?.secretAccessKey ?? "",
    };
    await writeStore(store);
    return;
  }

  const item = store.items.find((c) => c.id === id);
  if (!item) throw new Error("Unknown connection.");
  Object.assign(item, fields);
  await writeStore(store);
}

/**
 * Remove a connection. For a saved bucket this drops it from the list; for the env
 * default it persistently hides it (it would otherwise regenerate from the env vars) —
 * restorable later while the env vars remain set. Re-points active if needed.
 */
export async function removeConnection(id: string): Promise<void> {
  const store = (await readStore()) ?? { activeId: ENV_CONNECTION_ID, items: [] };

  if (id === ENV_CONNECTION_ID) {
    store.envHidden = true;
    delete store.envOverride; // drop any customization too
    if (store.activeId === ENV_CONNECTION_ID) {
      store.activeId = store.items[0]?.id ?? ENV_CONNECTION_ID; // env now resolves null
    }
    await writeStore(store);
    return;
  }

  store.items = store.items.filter((c) => c.id !== id);
  if (store.activeId === id) {
    store.activeId = resolveEnvConnection(store)
      ? ENV_CONNECTION_ID
      : store.items[0]?.id ?? ENV_CONNECTION_ID;
  }
  await writeStore(store);
}
