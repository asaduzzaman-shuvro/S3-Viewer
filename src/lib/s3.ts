import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { S3Connection } from "./connection";

// ---------------------------------------------------------------------------
// Per-connection S3 client (server-side only). The active connection's
// credentials + bucket come from `lib/connection` — env default or a runtime
// connection stored in an encrypted cookie. Clients are cached per credential
// set so we don't rebuild one on every call.
// ---------------------------------------------------------------------------
const clientCache = new Map<string, S3Client>();

function clientFor(conn: S3Connection): S3Client {
  const key = `${conn.region}:${conn.accessKeyId}:${conn.secretAccessKey}`;
  let client = clientCache.get(key);
  if (!client) {
    client = new S3Client({
      region: conn.region,
      credentials: {
        accessKeyId: conn.accessKeyId,
        secretAccessKey: conn.secretAccessKey,
      },
    });
    clientCache.set(key, client);
  }
  return client;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface S3File {
  key: string;
  name: string;
  size: number;
  lastModified: Date;
}

export interface S3ListResult {
  folders: string[]; // full prefix strings, e.g. "photos/2024/"
  files: S3File[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise a prefix: no leading slash, trailing slash unless empty (root). */
function normalisePrefix(prefix: string): string {
  let p = prefix.replace(/^\/+/, ""); // strip leading slashes
  if (p && !p.endsWith("/")) p += "/"; // ensure trailing slash
  return p;
}

/**
 * Confirm a connection works by issuing a minimal listing (one object).
 * Throws the underlying AWS error (e.g. InvalidAccessKeyId, NoSuchBucket) on failure.
 */
export async function validateConnection(conn: S3Connection): Promise<void> {
  const command = new ListObjectsV2Command({
    Bucket: conn.bucket,
    MaxKeys: 1,
  });
  await clientFor(conn).send(command);
}

/**
 * List folders and files at a given prefix (one level deep).
 * Pass an empty string (or "/") for the bucket root.
 */
export async function listPrefix(
  conn: S3Connection,
  prefix: string
): Promise<S3ListResult> {
  const normalisedPrefix = normalisePrefix(prefix);

  const command = new ListObjectsV2Command({
    Bucket: conn.bucket,
    Prefix: normalisedPrefix || undefined,
    Delimiter: "/",
  });

  const response = await clientFor(conn).send(command);

  // CommonPrefixes → "folders"
  const folders: string[] =
    response.CommonPrefixes?.map((cp) => cp.Prefix ?? "").filter(Boolean) ??
    [];

  // Contents → files (exclude the placeholder object for the prefix itself)
  const files: S3File[] =
    response.Contents?.filter((obj) => obj.Key !== normalisedPrefix)
      .map((obj) => ({
        key: obj.Key ?? "",
        name: (obj.Key ?? "").split("/").pop() ?? obj.Key ?? "",
        size: obj.Size ?? 0,
        lastModified: obj.LastModified ?? new Date(0),
      }))
      .filter((f) => f.key) ?? [];

  return { folders, files };
}

// ---------------------------------------------------------------------------
// Content-type map for common extensions
// ---------------------------------------------------------------------------
const CONTENT_TYPE_MAP: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  json: "application/json",
  txt: "text/plain",
  csv: "text/csv",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
};

export function contentTypeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPE_MAP[ext] ?? "application/octet-stream";
}

/**
 * Generate a short-lived presigned GET URL for a given S3 key.
 * The ResponseContentType header is set so browsers render the object
 * inline (e.g. PDFs open in the viewer instead of downloading).
 */
export async function presignGet(
  conn: S3Connection,
  key: string,
  expiresIn = 300
): Promise<string> {
  const contentType = contentTypeFromKey(key);

  const command = new GetObjectCommand({
    Bucket: conn.bucket,
    Key: key,
    ResponseContentType: contentType,
    // Instruct browser to display inline for viewable types
    ResponseContentDisposition: contentType.startsWith("application/octet")
      ? `attachment; filename="${key.split("/").pop()}"`
      : "inline",
  });

  return getSignedUrl(clientFor(conn), command, { expiresIn });
}
