// Server-only (Node.js runtime). Resolves the "active" S3 connection — the bucket +
// credentials the app should currently browse. Connections live in a local SQLite DB
// (Prisma); the secret access key is stored AES-256-GCM encrypted, never in plaintext.
//
// Do NOT import this from middleware (Edge runtime) — it uses Node `crypto` and Prisma.
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";
import type { AppSettings } from "@prisma/client";
import { getAppSecret } from "./auth";
import { prisma } from "./db";

// Implicit, non-removable id for the connection built from environment variables.
export const ENV_CONNECTION_ID = "env";

// Cap on saved (non-env) connections.
export const MAX_SAVED_CONNECTIONS = 10;

// Single global settings row.
const SETTINGS_ID = "global";

export interface S3Connection {
  id: string;
  label: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * A connection safe to send to the client — never includes the secret key, and
 * deliberately omits the access key ID too (the UI doesn't display or resubmit
 * it, so there's no reason to expose the IAM principal to client JS).
 */
export interface SanitizedConnection {
  id: string;
  label: string;
  bucket: string;
  region: string;
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
// Encryption — AES-256-GCM with a scrypt key derived from APP_SECRET.
// Each record carries its own random 16-byte scrypt salt, so the data key is
// not a pure function of APP_SECRET (defeats precomputation and cross-deployment
// key reuse). Format: "v2:" + base64( salt(16) | iv(12) | authTag(16) | ciphertext ).
//
// Legacy records (pre-v2) have no prefix and used a fixed salt; decrypt() still
// reads them, and any re-save migrates them to v2.
// ---------------------------------------------------------------------------
const KEY_VERSION = "v2:";
const LEGACY_SALT = "s3v-connection-store-v1";

let legacyKeyCache: Buffer | null = null;
function deriveKey(salt: Buffer | string): Buffer {
  return scryptSync(getAppSecret(), salt, 32);
}
function legacyKey(): Buffer {
  if (!legacyKeyCache) legacyKeyCache = deriveKey(LEGACY_SALT);
  return legacyKeyCache;
}

export function encrypt(plaintext: string): string {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(salt), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return KEY_VERSION + Buffer.concat([salt, iv, tag, ciphertext]).toString("base64");
}

export function decrypt(payload: string): string | null {
  try {
    if (payload.startsWith(KEY_VERSION)) {
      const raw = Buffer.from(payload.slice(KEY_VERSION.length), "base64");
      const salt = raw.subarray(0, 16);
      const iv = raw.subarray(16, 28);
      const tag = raw.subarray(28, 44);
      const ciphertext = raw.subarray(44);
      const decipher = createDecipheriv("aes-256-gcm", deriveKey(salt), iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    }
    // Legacy format: base64( iv(12) | authTag(16) | ciphertext ), fixed-salt key.
    const raw = Buffer.from(payload, "base64");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ciphertext = raw.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", legacyKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    // Tampered, wrong key (rotated APP_SECRET), or malformed.
    return null;
  }
}

// ---------------------------------------------------------------------------
// Settings (global singleton) + DB-row helpers
// ---------------------------------------------------------------------------
const DEFAULT_SETTINGS: AppSettings = {
  id: SETTINGS_ID,
  activeConnectionId: null,
  envHidden: false,
  envOverrideJson: null,
};

/** Read the global settings row (defaults if it doesn't exist yet) — no write. */
async function readSettings(): Promise<AppSettings> {
  return (await prisma.appSettings.findUnique({ where: { id: SETTINGS_ID } })) ?? DEFAULT_SETTINGS;
}

type EnvOverride = Omit<S3Connection, "id">;

function readEnvOverride(settings: AppSettings): EnvOverride | null {
  if (!settings.envOverrideJson) return null;
  const json = decrypt(settings.envOverrideJson);
  if (!json) return null;
  try {
    return JSON.parse(json) as EnvOverride;
  } catch {
    return null;
  }
}

type ConnRow = {
  id: string;
  label: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretEnc: string;
};

function rowToConnection(row: ConnRow): S3Connection {
  const secretAccessKey = decrypt(row.secretEnc) ?? "";
  if (!secretAccessKey) {
    // Decrypt failed (wrong key / tampered). Almost always means APP_SECRET changed
    // since this connection was saved, so its secret can no longer be unlocked.
    console.warn(
      `[connection] secret for "${row.label}" (${row.id}) could not be decrypted — ` +
        `APP_SECRET likely changed since it was saved. Re-enter this connection's secret.`
    );
  }
  return {
    id: row.id,
    label: row.label,
    region: row.region,
    bucket: row.bucket,
    accessKeyId: row.accessKeyId,
    secretAccessKey,
  };
}

/** True when a saved connection's stored secret can't be decrypted (e.g. APP_SECRET changed). */
export function hasUndecryptableSecret(conn: S3Connection): boolean {
  return conn.id !== ENV_CONNECTION_ID && conn.secretAccessKey === "";
}

/** The env-default connection, with any saved override applied — or null if hidden/unset. */
function resolveEnvConnection(settings: AppSettings): S3Connection | null {
  if (settings.envHidden) return null;
  const override = readEnvOverride(settings);
  if (override) return { id: ENV_CONNECTION_ID, ...override };
  return envConnection();
}

// ---------------------------------------------------------------------------
// Public API (same names as before — callers unchanged)
// ---------------------------------------------------------------------------

/** Add a new connection, make it active, and persist. Returns the saved item. */
export async function addConnection(input: Omit<S3Connection, "id">): Promise<S3Connection> {
  if ((await prisma.connection.count()) >= MAX_SAVED_CONNECTIONS) {
    throw new Error(
      `You can save at most ${MAX_SAVED_CONNECTIONS} connections. Remove one first.`
    );
  }
  const row = await prisma.connection.create({
    data: {
      label: input.label,
      region: input.region,
      bucket: input.bucket,
      accessKeyId: input.accessKeyId,
      secretEnc: encrypt(input.secretAccessKey),
    },
  });
  await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, activeConnectionId: row.id },
    update: { activeConnectionId: row.id },
  });
  return rowToConnection(row);
}

/** The id that actually resolves as active (mirrors getActiveConnection's precedence). */
async function effectiveActiveId(settings: AppSettings): Promise<string | null> {
  if (settings.activeConnectionId === ENV_CONNECTION_ID && resolveEnvConnection(settings)) {
    return ENV_CONNECTION_ID;
  }
  if (settings.activeConnectionId && settings.activeConnectionId !== ENV_CONNECTION_ID) {
    const exists = await prisma.connection.findUnique({
      where: { id: settings.activeConnectionId },
      select: { id: true },
    });
    if (exists) return settings.activeConnectionId;
  }
  return resolveEnvConnection(settings) ? ENV_CONNECTION_ID : null;
}

/** Resolve the active connection: the active saved row, else the env default, else null. */
export async function getActiveConnection(): Promise<S3Connection | null> {
  const settings = await readSettings();
  if (settings.activeConnectionId && settings.activeConnectionId !== ENV_CONNECTION_ID) {
    const row = await prisma.connection.findUnique({ where: { id: settings.activeConnectionId } });
    if (row) return rowToConnection(row);
  }
  return resolveEnvConnection(settings);
}

// Accepts any connection-shaped value (env connection or a raw DB row) — only the
// display fields are read, so the list path never has to decrypt the secret.
function sanitize(
  conn: { id: string; label: string; bucket: string; region: string },
  isActive: boolean,
  isOverridden = false
): SanitizedConnection {
  return {
    id: conn.id,
    label: conn.label,
    bucket: conn.bucket,
    region: conn.region,
    isEnv: conn.id === ENV_CONNECTION_ID,
    isActive,
    isOverridden,
  };
}

/** Sanitized list for the client: env default (if any) first, then saved items. */
export async function listConnections(): Promise<SanitizedConnection[]> {
  const settings = await readSettings();
  const env = resolveEnvConnection(settings);
  const activeId = await effectiveActiveId(settings);
  const rows = await prisma.connection.findMany({ orderBy: { createdAt: "asc" } });

  const out: SanitizedConnection[] = [];
  if (env) out.push(sanitize(env, env.id === activeId, !!readEnvOverride(settings)));
  // Sanitize straight from the row — no need to decrypt the secret just to list.
  for (const row of rows) out.push(sanitize(row, row.id === activeId));
  return out;
}

/** Make an existing connection (env or saved) the active one. */
export async function setActiveConnection(id: string): Promise<void> {
  if (id === ENV_CONNECTION_ID) {
    if (!hasEnvConnection()) throw new Error("Unknown connection.");
    // Activating the env default also un-hides it if it had been deleted.
    await prisma.appSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, activeConnectionId: ENV_CONNECTION_ID, envHidden: false },
      update: { activeConnectionId: ENV_CONNECTION_ID, envHidden: false },
    });
    return;
  }
  const row = await prisma.connection.findUnique({ where: { id }, select: { id: true } });
  if (!row) throw new Error("Unknown connection.");
  await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, activeConnectionId: id },
    update: { activeConnectionId: id },
  });
}

/** True when the env default is configured but currently hidden (deleted) — restorable. */
export async function canRestoreEnvDefault(): Promise<boolean> {
  if (!hasEnvConnection()) return false;
  return (await readSettings()).envHidden;
}

/** Raw connection (incl. secret) for server-side use. Null if it doesn't exist. */
export async function getStoredConnection(id: string): Promise<S3Connection | null> {
  if (id === ENV_CONNECTION_ID) return resolveEnvConnection(await readSettings());
  const row = await prisma.connection.findUnique({ where: { id } });
  return row ? rowToConnection(row) : null;
}

/**
 * Update a connection's fields and persist; active stays put. For the env default the
 * change is stored as an (encrypted) override that wins over the env vars until reset.
 */
export async function updateConnection(
  id: string,
  fields: Partial<Omit<S3Connection, "id">>
): Promise<void> {
  if (id === ENV_CONNECTION_ID) {
    const settings = await readSettings();
    const base = resolveEnvConnection(settings) ?? envConnection();
    const override: EnvOverride = {
      label: fields.label ?? base?.label ?? "",
      region: fields.region ?? base?.region ?? "",
      bucket: fields.bucket ?? base?.bucket ?? "",
      accessKeyId: fields.accessKeyId ?? base?.accessKeyId ?? "",
      secretAccessKey: fields.secretAccessKey ?? base?.secretAccessKey ?? "",
    };
    const envOverrideJson = encrypt(JSON.stringify(override));
    await prisma.appSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, envOverrideJson },
      update: { envOverrideJson },
    });
    return;
  }

  const row = await prisma.connection.findUnique({ where: { id }, select: { id: true } });
  if (!row) throw new Error("Unknown connection.");
  await prisma.connection.update({
    where: { id },
    data: {
      ...(fields.label !== undefined ? { label: fields.label } : {}),
      ...(fields.region !== undefined ? { region: fields.region } : {}),
      ...(fields.bucket !== undefined ? { bucket: fields.bucket } : {}),
      ...(fields.accessKeyId !== undefined ? { accessKeyId: fields.accessKeyId } : {}),
      ...(fields.secretAccessKey !== undefined
        ? { secretEnc: encrypt(fields.secretAccessKey) }
        : {}),
    },
  });
}

/**
 * Remove a connection. A saved bucket is deleted; the env default is persistently hidden
 * (it would otherwise regenerate from the env vars) — restorable while the env vars remain
 * set. Re-points the active connection if the removed one was active.
 */
export async function removeConnection(id: string): Promise<void> {
  const settings = await readSettings();

  if (id === ENV_CONNECTION_ID) {
    let activeConnectionId = settings.activeConnectionId;
    if (activeConnectionId === ENV_CONNECTION_ID) {
      const first = await prisma.connection.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
      activeConnectionId = first?.id ?? null;
    }
    await prisma.appSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, envHidden: true, activeConnectionId },
      update: { envHidden: true, envOverrideJson: null, activeConnectionId },
    });
    return;
  }

  await prisma.connection.delete({ where: { id } }).catch(() => {});
  if (settings.activeConnectionId === id) {
    let activeConnectionId: string | null;
    if (resolveEnvConnection(settings)) {
      activeConnectionId = ENV_CONNECTION_ID;
    } else {
      const first = await prisma.connection.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
      activeConnectionId = first?.id ?? null;
    }
    await prisma.appSettings.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, activeConnectionId },
      update: { activeConnectionId },
    });
  }
}
