# Architecture

How S3 Storage Viewer is put together, and how a request flows from the browser
through authentication to S3 and back. The app is a Next.js 16 App Router project
that runs across two runtimes: **Edge** (the auth middleware) and **Node.js**
(everything that touches the AWS SDK).

## Overview

The app does one thing: present an S3 bucket as a browsable, previewable file tree
behind a password. There is no database — S3 *is* the data store. State that isn't
in S3 lives in two environment-derived secrets (`APP_PASSWORD` for login,
`APP_SECRET` for the auth cookie) and a single `s3v_auth` cookie on the client.

## Components

| Component | Lives in | Responsibility |
|-----------|----------|----------------|
| **Edge middleware** | `src/proxy.ts` | Gate every request; redirect unauthenticated visitors to `/login`. Edge-safe (no Node crypto). |
| **Edge-safe auth** | `src/lib/auth.ts` | `isAuthedRequest(req)` and `isAuthed()` compare the `s3v_auth` cookie to `APP_SECRET`. No Node imports, so usable from both Edge and server components. |
| **Node-only auth** | `src/lib/auth.server.ts` | `verifyPassword()` — constant-time `timingSafeEqual` check, used only by the login route. |
| **S3 access layer** | `src/lib/s3.ts` | The singleton `S3Client`, `listPrefix()`, `presignGet()`, `contentTypeFromKey()`. The only module that talks to AWS. |
| **API routes** | `src/app/api/*` | `login`, `logout`, `list`, `signed-url` — JSON endpoints, each re-checking auth. |
| **Pages** | `src/app/{login,browse,preview}` | Server components that render the UI. `browse` and `preview` read S3 directly server-side. |
| **UI components** | `src/components/*` | `Breadcrumb`, `FileRow`, `ImagePreview`, `PdfPreview`, `JsonPreview`, `LogoutButton`. |

## Data flow: a browse request

Tracing `GET /browse/photos/2024` from URL to rendered page:

```
Browser
  │  GET /browse/photos/2024   (cookie: s3v_auth=<APP_SECRET>)
  ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. Edge middleware — src/proxy.ts                            │
│    • matcher skips /_next/static, /_next/image, favicon.ico  │
│    • PUBLIC_PATHS (/login, /api/login) and /_next, /favicon  │
│      pass straight through                                   │
│    • isAuthedRequest(req): cookie value === APP_SECRET ?     │
│        no  → 302 redirect to /login                          │
│        yes → NextResponse.next()                             │
└─────────────────────────────────────────────────────────────┘
  │ authenticated
  ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Browse server component                                   │
│    src/app/browse/[[...path]]/page.tsx                       │
│    • await isAuthed()  → redirect("/login") if false         │
│      (defense in depth — middleware already checked)         │
│    • params.path = ["photos","2024"]                         │
│    • decodeURIComponent each segment → prefix "photos/2024/" │
│    • const { folders, files } = await listPrefix(prefix)     │
└─────────────────────────────────────────────────────────────┘
  │ prefix = "photos/2024/"
  ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. S3 access layer — src/lib/s3.ts → listPrefix()            │
│    • normalisePrefix(): strip leading "/", ensure trailing   │
│      "/" (empty string = bucket root)                        │
│    • ListObjectsV2Command { Bucket, Prefix, Delimiter: "/" } │
│    • CommonPrefixes → folders[]  (e.g. "photos/2024/jan/")   │
│    • Contents       → files[]    (excludes the prefix's own  │
│                        placeholder object)                   │
└─────────────────────────────────────────────────────────────┘
  │ { folders, files }
  ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Render (back in the server component)                     │
│    • folders → rows linking to /browse/<segments>/<name>     │
│    • files   → rows linking to /preview/<encoded key>        │
│    • <Breadcrumb>, <FileRow>, <LogoutButton>                 │
│    • server-rendered HTML streamed to the browser            │
└─────────────────────────────────────────────────────────────┘
  │ HTML
  ▼
Browser renders the listing. Clicking a row issues a new request,
re-entering at step 1.
```

The key mechanic in step 3 is `Delimiter: "/"`. It tells S3 to collapse everything
below the next `/` into a `CommonPrefix` (a "folder") rather than returning every
object recursively — which is what makes a flat key space browsable one level at
a time.

## Adjacent flows

- **Preview.** `/preview/[...key]` resolves a presigned URL for the object. The
  matching API route, `GET /api/signed-url?key=`, calls `presignGet(key)` which
  builds a `GetObjectCommand` and signs it with `getSignedUrl` (default 5-minute
  expiry). `ResponseContentDisposition` is `inline` for viewable types and
  `attachment` for `application/octet-stream`, so PDFs and images open in-page
  while unknown types download.
- **`GET /api/list?prefix=`.** A JSON sibling of the browse page — same
  `listPrefix()` call, returned as JSON instead of HTML. Note the browse page does
  **not** use this endpoint; it calls `listPrefix()` directly server-side. The
  endpoint exists for programmatic/client use.
- **Login / logout.** `POST /api/login` runs in the Node.js runtime (it needs
  `crypto.timingSafeEqual`), and on success sets `s3v_auth = APP_SECRET`.
  `POST /api/logout` clears the cookie with `maxAge: 0`.

## Key decisions

- **Two auth helpers, split by runtime.** Edge middleware can't use Node's `crypto`,
  so the cookie check (`isAuthedRequest`) is a plain string comparison in
  `src/lib/auth.ts`, while the password check (`verifyPassword`, constant-time) is
  isolated in `src/lib/auth.server.ts` and only ever imported by the Node-runtime
  login route. Mixing them would break the Edge build.
- **The cookie *is* the secret.** Rather than signing a session, the app stores
  `APP_SECRET` verbatim in the cookie and compares against it. Simple and stateless,
  at the cost of having no per-user identity or revocation.
- **S3 as the only backend.** No database, no caching layer. Every listing is a
  live `ListObjectsV2` call; every preview is a fresh presigned URL.
- **Server-side rendering for browse/preview.** These pages read S3 on the server
  and render HTML, so credentials and presigning stay off the client.

## External dependencies

- **AWS S3**, via `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner`
  (`^3.1045.0`) — the source of all data and presigned URLs.
- **`react-json-view-lite`** — renders JSON files in the preview page.

## Known limitations & discrepancies

These are accurate to the code as read; flagged here so the docs don't paper over
them:

- **No pagination.** `listPrefix()` sends one `ListObjectsV2Command` and reads a
  single page of results. A prefix with more than ~1,000 immediate children will be
  silently truncated; handling `IsTruncated`/`ContinuationToken` would be needed.
- **`CLAUDE.md` is slightly out of date.** It states that server components use
  `isAuthed()` from `lib/auth.server.ts`. In the actual code, both `isAuthedRequest`
  and the async `isAuthed` live in `src/lib/auth.ts`; `auth.server.ts` contains only
  `verifyPassword`. The browse page imports `isAuthed` from `@/lib/auth`.
- **Middleware file naming.** The middleware lives in `src/proxy.ts` exporting a
  `proxy` function, rather than Next.js's conventional `middleware.ts` /
  `export function middleware`. If the redirect ever appears not to run, this
  naming is the first thing to check against your Next.js version's middleware
  resolution.
- **Cookie `secure` flag is disabled.** Commented out in the login route — fine for
  local dev, must be enabled before serving over HTTPS.
