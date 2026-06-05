import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ---------------------------------------------------------------------------
// Singleton S3 client — credentials come from .env.local (server-side only)
// ---------------------------------------------------------------------------
const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET!;

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
 * List folders and files at a given prefix (one level deep).
 * Pass an empty string (or "/") for the bucket root.
 */
export async function listPrefix(prefix: string): Promise<S3ListResult> {
  const normalisedPrefix = normalisePrefix(prefix);

  const command = new ListObjectsV2Command({
    Bucket: BUCKET,
    Prefix: normalisedPrefix || undefined,
    Delimiter: "/",
  });

  const response = await s3.send(command);

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
  key: string,
  expiresIn = 300
): Promise<string> {
  const contentType = contentTypeFromKey(key);

  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentType: contentType,
    // Instruct browser to display inline for viewable types
    ResponseContentDisposition: contentType.startsWith("application/octet")
      ? `attachment; filename="${key.split("/").pop()}"`
      : "inline",
  });

  return getSignedUrl(s3, command, { expiresIn });
}
