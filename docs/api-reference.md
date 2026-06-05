# API Reference — `src/lib/s3.ts`

The S3 access layer. This module owns the singleton `S3Client` and is the only
place in the app that talks to AWS. It's **server-only** — it reads AWS
credentials from the environment at module load, so importing it from client
components or Edge middleware will fail.

```ts
import { listPrefix, presignGet, contentTypeFromKey } from "@/lib/s3";
```

> Library note: signatures below are documented from the source in this repo
> against `@aws-sdk/client-s3` / `@aws-sdk/s3-request-presigner` `^3.1045.0`.
> Context7 was unavailable (monthly quota exceeded) when these docs were written,
> so the AWS SDK details were not re-verified against a freshly fetched spec — if
> you bump the SDK major version, re-check `getSignedUrl` and `ListObjectsV2Command`
> options via Context7.

## Environment

The module reads these at import time and will use them for every call:

| Variable | Used for |
|----------|----------|
| `AWS_REGION` | `S3Client` region |
| `AWS_ACCESS_KEY_ID` | `S3Client` credentials |
| `AWS_SECRET_ACCESS_KEY` | `S3Client` credentials |
| `S3_BUCKET` | Target bucket for all commands |

## Types

### `S3File`

A single file entry returned by `listPrefix`.

```ts
interface S3File {
  key: string;          // full S3 key, e.g. "photos/2024/cat.jpg"
  name: string;         // last path segment, e.g. "cat.jpg"
  size: number;         // bytes (0 if S3 omitted Size)
  lastModified: Date;   // epoch (new Date(0)) if S3 omitted LastModified
}
```

### `S3ListResult`

The shape returned by `listPrefix`.

```ts
interface S3ListResult {
  folders: string[];    // full prefix strings, e.g. "photos/2024/"
  files: S3File[];
}
```

---

## `listPrefix(prefix)`

List the folders and files directly under a prefix — one level deep, like opening
a folder in a file explorer.

**Parameters**

- `prefix` (`string`) — the prefix to list. Pass `""` (or `"/"`) for the bucket
  root. Leading slashes are stripped and a trailing slash is added if missing, so
  `"photos/2024"`, `"/photos/2024/"`, and `"photos/2024/"` are equivalent.

**Returns:** `Promise<S3ListResult>` — `folders` (from S3 `CommonPrefixes`) and
`files` (from `Contents`). The placeholder object whose key equals the prefix
itself is excluded, so an "empty folder" marker doesn't show up as a file.

**How it works:** issues one `ListObjectsV2Command` with `Delimiter: "/"`. The
delimiter is what produces the one-level view — S3 rolls everything below the next
`/` into a `CommonPrefix` instead of returning it recursively.

**Throws:** propagates any error from `s3.send()` (e.g. credentials, network,
`NoSuchBucket`). Callers in the API routes wrap this in a `try/catch` and return
`500`.

> ⚠️ **No pagination.** Only the first page of results is read (~1,000 objects).
> Prefixes with more immediate children are truncated. If you need full coverage,
> loop on `IsTruncated` / `ContinuationToken`.

**Example**

```ts
// List the bucket root
const root = await listPrefix("");
// root.folders → ["photos/", "documents/"]
// root.files   → [{ key: "readme.txt", name: "readme.txt", size: 42, lastModified: ... }]

// List one folder deep
const sub = await listPrefix("photos/2024");
// sub.folders → ["photos/2024/january/", "photos/2024/february/"]
```

---

## `presignGet(key, expiresIn?)`

Generate a short-lived presigned GET URL for an object, with response headers set
so browsers render viewable types inline.

**Parameters**

- `key` (`string`) — the full S3 key of the object.
- `expiresIn` (`number`, optional, default `300`) — URL lifetime in **seconds**
  (default 5 minutes).

**Returns:** `Promise<string>` — a presigned URL anyone can `GET` until it expires.

**Behavior:** builds a `GetObjectCommand` with:
- `ResponseContentType` set from `contentTypeFromKey(key)`, so the browser knows
  how to render it.
- `ResponseContentDisposition` of `inline` for viewable types, or
  `attachment; filename="<name>"` when the content type is `application/octet…`
  (i.e. unknown types download instead of rendering).

Then signs it with `getSignedUrl` from `@aws-sdk/s3-request-presigner`.

**Example**

```ts
const url = await presignGet("photos/2024/cat.jpg");        // 5-minute URL, opens inline
const dl  = await presignGet("archive/backup.bin", 60);     // 1-minute URL, downloads
```

---

## `contentTypeFromKey(key)`

Map a key's file extension to a MIME type.

**Parameters**

- `key` (`string`) — any key or filename; only the part after the last `.` matters.

**Returns:** `string` — the mapped MIME type, or `"application/octet-stream"` if
the extension isn't recognized.

**Recognized extensions:**

| Type | Extensions |
|------|------------|
| Documents | `pdf` → `application/pdf` |
| Images | `png`, `jpg`/`jpeg`, `gif`, `webp`, `svg` |
| Data/text | `json`, `txt`, `csv` |
| Media | `mp4` → `video/mp4`, `mp3` → `audio/mpeg` |

Anything else falls back to `application/octet-stream` (which `presignGet` treats
as a download).

**Example**

```ts
contentTypeFromKey("report.pdf");   // "application/pdf"
contentTypeFromKey("IMG_2024.JPG"); // "image/jpeg"  (case-insensitive)
contentTypeFromKey("data.parquet"); // "application/octet-stream"
```

---

## Internal helpers (not exported)

- **`normalisePrefix(prefix)`** — strips leading slashes and ensures a single
  trailing slash (empty stays empty for the root). Called by `listPrefix`.
- **`s3`** — the module-level singleton `S3Client`.
- **`BUCKET`** — `process.env.S3_BUCKET`, captured at module load.

## Used by

- `src/app/browse/[[...path]]/page.tsx` — calls `listPrefix()` directly.
- `src/app/api/list/route.ts` — wraps `listPrefix()` as JSON.
- `src/app/api/signed-url/route.ts` — calls `presignGet()` and `contentTypeFromKey()`.
- `src/app/preview/[...key]/page.tsx` — presigns the object for inline preview.
