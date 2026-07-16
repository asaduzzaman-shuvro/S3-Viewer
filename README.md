# S3 Storage Viewer

A small [Next.js 16](https://nextjs.org/) web app for browsing and previewing the
contents of an AWS S3 bucket, behind a single shared password. Navigate folders,
see file sizes and modified dates, and preview images, PDFs, JSON, and text
inline — without exposing the bucket publicly.

## Features

- **Folder browsing** — walk the bucket one level at a time, like a file explorer.
- **Inline previews** — images, PDFs, JSON (via `react-json-view-lite`), and text
  render directly in the browser using short-lived presigned URLs.
- **Theme picker** — Light, Dark, or System (follow OS) theme, saved per browser.
  Change it anywhere in the app and it's reflected everywhere instantly.
- **Bucket switching** — add, switch, edit, or remove S3 buckets at runtime via a
  dropdown in the header; credentials are encrypted and never sent to the client.
  Switching resets you to the new bucket's root to ensure a valid path.
- **Presigned access** — files are served through 5-minute presigned GET URLs;
  bucket credentials never reach the client.
- **Password gate** — one shared password protects every page and API route, with a
  constant-time login check and per-client rate limiting against brute force.
- **Dual runtime** — Edge middleware for the auth redirect, Node.js for S3 access.

## Tech stack

| Concern   | Choice |
|-----------|--------|
| Framework | Next.js `16.2.6` (App Router) |
| UI        | React `19.2.4`, inline `React.CSSProperties` styles (no CSS framework) |
| Language  | TypeScript `5` |
| AWS       | `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (`^3.1045.0`) |
| Database  | Prisma `6` + SQLite (`prisma/dev.db`) — stores saved S3 connections |
| JSON view | `react-json-view-lite` `^2.5.0` |

## 🚀 Getting started

> [!TIP]
> **New here?** The whole setup is three steps: install deps
> (`npm install` + `npx prisma migrate dev`), set the two required env vars
> (`APP_PASSWORD` and `APP_SECRET`), then `npm run dev` → http://localhost:3000.

### Prerequisites

- **Node.js 20+** (matches `@types/node` `^20`).
- An **AWS S3 bucket** and IAM credentials with at least `s3:ListBucket` (on the
  bucket) and `s3:GetObject` (on its objects).

### Installation

```bash
npm install                 # also runs `prisma generate` (postinstall)
npx prisma migrate dev      # create the local SQLite DB (prisma/dev.db) from migrations
```

The SQLite database stores saved S3 connections. Its schema + migrations are committed;
the `prisma/dev.db` data file is gitignored. No `DATABASE_URL` is needed — the SQLite path
is set directly in `prisma/schema.prisma`.

### Configuration

Copy the example env file and fill it in:

```bash
cp .env.example .env.local
```

> [!IMPORTANT]
> **Two variables are mandatory — the app will not start without them:
> `APP_PASSWORD` and `APP_SECRET`.** Everything else is optional.

**Required:**

| Variable       | Purpose |
|----------------|---------|
| `APP_PASSWORD` | The password users type at `/login`. **At least 12 characters, with at least one uppercase letter, one lowercase letter, one number, and one special character.** |
| `APP_SECRET`   | Signs the auth-cookie token **and** is the key that encrypts saved S3 credentials. **Must be more than 24 characters with at least 4 digits and 4 special characters** (a long passphrase — `openssl rand -hex` has no symbols and won't qualify). The app refuses to start until it's set and compliant. |

**Optional — a default S3 bucket:**

| Variable                | Purpose |
|-------------------------|---------|
| `AWS_REGION`            | Region of the bucket, e.g. `us-east-1`. |
| `S3_BUCKET`             | Name of the bucket to browse. |
| `AWS_ACCESS_KEY_ID`     | IAM access key id used by the S3 client. |
| `AWS_SECRET_ACCESS_KEY` | IAM secret access key. |

Provide **all four** AWS vars to start with a default bucket, or **none** of them —
if they're absent you simply connect a bucket from the in-app form after logging in
(and you can add or switch buckets anytime via the top-right switcher). Partial AWS
config is treated as no default. All values are read server-side only and never sent
to the browser.

### Run

```bash
npm run dev      # start the dev server at http://localhost:3000
```

Open the app, enter `APP_PASSWORD` at `/login`, and you'll be redirected to the
bucket root at `/browse`.

### Bucket CORS (for the local cache)

The client-side preview cache reads object bytes with `fetch()`, so the bucket must
allow this app's origin. Add a CORS configuration to the bucket (S3 console → the
bucket → *Permissions* → *Cross-origin resource sharing (CORS)*):

```json
[
  {
    "AllowedOrigins": ["http://localhost:3000", "https://your-app-domain"],
    "AllowedMethods": ["GET"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["Content-Length", "Content-Type", "ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Replace `https://your-app-domain` with wherever you host the app. This is optional —
without it, previews still work (loaded directly from S3), they just aren't cached.

## Scripts

All scripts are defined in `package.json`:

| Command         | What it does |
|-----------------|--------------|
| `npm run dev`   | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint`  | Run ESLint (`eslint-config-next`) |

## How it works

- **Auth.** `POST /api/login` checks the submitted password against `APP_PASSWORD`
  with a constant-time comparison (`timingSafeEqual`, see `src/lib/auth.server.ts`)
  and, on success, sets the `s3v_auth` cookie to a one-way token derived from
  `APP_SECRET` (`SHA-256(APP_SECRET + ":s3v-auth-v1")`) — not the secret itself, so a
  leaked cookie can't reveal the credential-encryption key. Every subsequent request is
  checked by the Edge middleware in `src/proxy.ts`, which redirects unauthenticated
  visitors to `/login`. The four API routes also re-check the cookie and return `401`
  if it's missing or wrong. Repeated failed logins are rate-limited per client
  (in-memory lockout; `src/lib/rate-limit.ts`), and the cookie comparison is
  constant-time.
- **Bucket connections.** The app stores saved S3 buckets in the local SQLite DB,
  with each connection's secret access key encrypted under `APP_SECRET` (AES-256-GCM
  with a random per-record scrypt salt). The active connection is resolved by
  `src/lib/connection.ts` — a saved connection takes precedence, or the env-default,
  or none. Users can add, switch, edit, and remove buckets at runtime via the
  `BucketSwitcher` in the top-right. Switching to a new bucket navigates to its root
  (`/browse`) to ensure a valid path — the bucket's folder structure may differ.
- **Listing.** `listPrefix()` in `src/lib/s3.ts` runs a single
  `ListObjectsV2Command` with `Delimiter: "/"`, so `CommonPrefixes` become folders
  and `Contents` become files — a one-level-deep view of the bucket.
- **Previewing.** `presignGet()` generates a 5-minute presigned GET URL with
  `ResponseContentType`/`ResponseContentDisposition` set so viewable types open
  inline and everything else downloads as an attachment.
- **Local file cache.** Previewed images and PDFs are cached in the browser's
  **IndexedDB** (`src/lib/blobCache.ts`, via the `useCachedObjectUrl` hook): the first
  view fetches the bytes directly from S3 and stores the blob keyed by
  `` `${connectionId}:${key}` ``; later views are served instantly from local disk with
  no network. The cache is bounded to ~2 GB with LRU eviction and persists across
  sessions. **This requires a CORS policy on the bucket** (so the browser can read the
  bytes) — see [Bucket CORS](#bucket-cors-for-the-local-cache) below. Without it,
  previews still load directly from S3 (just uncached), and a **Fetch from remote**
  button forces a fresh copy.
- **Theming.** The app supports Light, Dark, and System (follow OS) themes, with
  the choice saved to `localStorage`. A pre-paint script in `layout.tsx` applies
  the theme before the first paint to avoid flashing the wrong theme. The theme is
  re-applied on every mount and on `pageshow` (back/forward cache) to ensure it's
  always in sync across pages. The theme can be changed from a dropdown in the header
  (`ThemeToggle`) and the choice persists across logins and sessions.

See [`docs/architecture.md`](docs/architecture.md) for the full request flow and
[`docs/api-reference.md`](docs/api-reference.md) for the `src/lib/s3.ts` API.

## Routes

### Pages

| Path                  | Description |
|-----------------------|-------------|
| `/login`              | Password entry form |
| `/browse/[[...path]]` | Folder browser (catch-all; root is `/browse`) |
| `/preview/[...key]`   | Inline file preview |

### API

| Method & path              | Description |
|----------------------------|-------------|
| `POST /api/login`          | Validate `APP_PASSWORD`, set the auth cookie (`429` when rate-limited) |
| `POST /api/logout`         | Clear the auth cookie |
| `GET /api/list?prefix=`    | List folders & files at a prefix (JSON) |
| `GET /api/signed-url?key=` | Return a presigned URL + content type for a key (JSON) |
| `POST /api/connection`     | Add a new S3 bucket connection |
| `PATCH /api/connection`    | Activate a saved connection by id |
| `PUT /api/connection`      | Edit an existing connection (region, bucket, credentials) |
| `DELETE /api/connection`   | Remove a saved connection |

## Project structure

```
src/
  app/
    api/
      list/route.ts        — GET /api/list — list folders & files at a prefix
      login/route.ts       — POST /api/login — validate password, set cookie
      logout/route.ts      — POST /api/logout — clear cookie
      signed-url/route.ts  — GET /api/signed-url — presigned URL for a key
      connection/route.ts  — POST/PATCH/PUT/DELETE — add/activate/edit/remove a connection
    browse/[[...path]]/     — Folder browser (server component, catch-all route)
    preview/[...key]/       — File preview page
    login/                  — Login page
  components/
    Breadcrumb.tsx          — Folder navigation trail
    FileRow.tsx             — Single file/folder row in the listing
    ImagePreview.tsx        — Inline image viewer
    JsonPreview.tsx         — Inline JSON viewer with tree/raw modes
    PdfPreview.tsx          — Inline PDF viewer
    LogoutButton.tsx        — Sign-out button
    ConnectionForm.tsx      — Form for entering S3 credentials
    BucketSwitcher.tsx      — Dropdown to add/switch/edit/remove buckets
    ThemeToggle.tsx         — Light/Dark/System theme picker
  lib/
    s3.ts                  — S3 client, listPrefix(), presignGet(), contentTypeFromKey()
    connection.ts          — Active-connection resolver (SQLite store or env default); encrypt()/decrypt()
    db.ts                  — PrismaClient singleton
    auth.ts                — Edge-safe cookie auth helpers (isAuthedRequest, isAuthed)
    auth.server.ts         — Node-only verifyPassword() (timingSafeEqual)
  proxy.ts                 — Edge middleware: redirect unauthenticated requests to /login
prisma/
  schema.prisma            — Connection + AppSettings models (committed; dev.db gitignored)
```

## Security notes

- This is **single shared-password** auth — there are no user accounts or per-user
  sessions. It's suitable for gating an internal tool, not for protecting highly
  sensitive data. Login is **rate-limited per client** (in-memory lockout after
  repeated failures; `src/lib/rate-limit.ts`), and both the password check and the
  auth-cookie comparison run in constant time.
- The `s3v_auth` cookie is `httpOnly`, `sameSite: lax`, and `Secure` **in production**
  (`COOKIE_SECURE = NODE_ENV === "production"` in `src/lib/auth.ts`). Serve production
  over HTTPS or the cookie won't be sent; local dev runs over `http://localhost` without
  the Secure flag.
- **Saved S3 credentials** live in the SQLite DB with the secret access key stored
  **AES-256-GCM-encrypted** (scrypt key from `APP_SECRET` + a random per-record salt) —
  never plaintext, never sent to the browser (the bucket switcher receives neither secret
  keys nor access key IDs). Changing `APP_SECRET` makes existing saved secrets
  undecryptable; the browse page detects this and prompts you to re-enter the secret,
  which re-encrypts it under the new `APP_SECRET`.
- The **theme preference** is stored in the browser's `localStorage` (no server
  involvement) and visible in DevTools — it's not sensitive data, just a UI setting.
- `listPrefix()` issues a single `ListObjectsV2Command` with no pagination, so a
  prefix with more than 1,000 immediate children will be truncated.
