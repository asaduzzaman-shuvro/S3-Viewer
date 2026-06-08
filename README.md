# S3 Storage Viewer

A small [Next.js 16](https://nextjs.org/) web app for browsing and previewing the
contents of an AWS S3 bucket, behind a single shared password. Navigate folders,
see file sizes and modified dates, and preview images, PDFs, JSON, and text
inline — without exposing the bucket publicly.

## Features

- **Folder browsing** — walk the bucket one level at a time, like a file explorer.
- **Inline previews** — images, PDFs, JSON (via `react-json-view-lite`), and text
  render directly in the browser using short-lived presigned URLs.
- **Presigned access** — files are served through 5-minute presigned GET URLs;
  bucket credentials never reach the client.
- **Password gate** — one shared password protects every page and API route, with
  a constant-time comparison on login.
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

## Getting started

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
| `APP_PASSWORD` | The password users type at `/login`. **At least 8 characters, with at least one number and one letter.** |
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
  if it's missing or wrong.
- **Listing.** `listPrefix()` in `src/lib/s3.ts` runs a single
  `ListObjectsV2Command` with `Delimiter: "/"`, so `CommonPrefixes` become folders
  and `Contents` become files — a one-level-deep view of the bucket.
- **Previewing.** `presignGet()` generates a 5-minute presigned GET URL with
  `ResponseContentType`/`ResponseContentDisposition` set so viewable types open
  inline and everything else downloads as an attachment.

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
| `POST /api/login`          | Validate `APP_PASSWORD`, set the auth cookie |
| `POST /api/logout`         | Clear the auth cookie |
| `GET /api/list?prefix=`    | List folders & files at a prefix (JSON) |
| `GET /api/signed-url?key=` | Return a presigned URL + content type for a key (JSON) |

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
  components/               — Breadcrumb, FileRow, previews, LogoutButton, ConnectionForm, BucketSwitcher
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

- This is **single shared-password** auth — there are no user accounts, sessions,
  or rate limiting. It's suitable for gating an internal tool, not for protecting
  highly sensitive data.
- The auth and credential cookies are `httpOnly`, `sameSite: lax`, and `Secure` in all
  environments (`COOKIE_SECURE` in `src/lib/auth.ts`), so they're never sent over plain
  HTTP. Note: serve over HTTPS (or `http://localhost`) or the cookies won't be set.
- `listPrefix()` issues a single `ListObjectsV2Command` with no pagination, so a
  prefix with more than 1,000 immediate children will be truncated.
