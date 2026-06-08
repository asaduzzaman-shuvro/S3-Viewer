# S3 Storage Viewer

A Next.js 16 app for browsing and previewing files stored in an AWS S3 bucket, protected by a simple password-based auth.

## Stack

- **Framework**: Next.js 16 (App Router) with React 19
- **Language**: TypeScript 5
- **AWS**: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- **Database**: Prisma 6 + SQLite (local `prisma/dev.db`) — stores saved S3 connections
- **Runtime**: Node.js (server components/routes), Edge (middleware)

## Project Structure

```
src/
  app/
    api/
      list/route.ts       — GET /api/list?prefix= — lists folders & files at a prefix
      login/route.ts      — POST /api/login — validates APP_PASSWORD, sets auth cookie
      logout/route.ts     — POST /api/logout — clears the auth cookie (saved connections persist)
      signed-url/route.ts — GET /api/signed-url?key= — returns a presigned S3 URL
      connection/route.ts — POST/PATCH/DELETE — add/activate/remove a runtime S3 connection
    browse/[[...path]]/   — Server component: folder browser (catch-all route)
    login/                — Login page
    preview/[...key]/     — File preview page (images, PDF, JSON, etc.)
  components/
    Breadcrumb.tsx        — Navigation breadcrumb for current path
    FileRow.tsx           — Single row in the file/folder listing
    ImagePreview.tsx      — Inline image viewer
    JsonPreview.tsx       — JSON viewer (uses react-json-view-lite)
    LogoutButton.tsx      — Client component logout button
    PdfPreview.tsx        — Inline PDF viewer
    ConnectionForm.tsx    — Client form to enter/validate S3 bucket credentials
    BucketSwitcher.tsx    — Top-right control to switch/add/remove S3 connections
  lib/
    s3.ts                 — Per-connection S3 client; listPrefix(), presignGet(), validateConnection(), contentTypeFromKey()
    connection.ts         — Resolves the active S3 connection (env default or the SQLite/Prisma store); encrypt()/decrypt()
    db.ts                 — PrismaClient singleton (Node-only; never import from middleware)
    auth.ts               — Cookie-based auth helpers (Edge-safe); isAuthed(), isAuthedRequest(), getAppSecret()
    auth.server.ts        — Node-only verifyPassword() (constant-time)
  proxy.ts                — Middleware: redirects unauthenticated requests to /login
prisma/
  schema.prisma           — Connection + AppSettings models (committed)
  migrations/             — committed; the dev.db data file is gitignored
```

## Environment Variables

Copy `.env.example` to `.env.local`:

```
APP_PASSWORD=   # REQUIRED — password users enter at /login
APP_SECRET=     # REQUIRED — strong random string (>=16 chars; `openssl rand -hex 32`)
                #            secures the auth cookie AND encrypts saved S3 credentials
AWS_ACCESS_KEY_ID=      # OPTIONAL — default S3 connection (see below)
AWS_SECRET_ACCESS_KEY=  # OPTIONAL
AWS_REGION=             # OPTIONAL
S3_BUCKET=              # OPTIONAL
```

**`APP_PASSWORD` and `APP_SECRET` are the only two required vars** — the app throws on
the first request without `APP_SECRET` (it encrypts saved credentials), and login needs
`APP_PASSWORD`. The four AWS vars are **optional**: provide all four for a default
bucket, or none and connect a bucket at runtime via the in-app form after login (add /
switch buckets anytime via the switcher). Partial AWS config counts as no default.

## Auth Model

- Password-only auth: `APP_PASSWORD` is checked on login; on success, the `s3v_auth` cookie is set to a one-way token (`authToken()` = `SHA-256(APP_SECRET + ":s3v-auth-v1")`), **not** `APP_SECRET` itself, so a leaked cookie can't reveal the credential-encryption key.
- All routes (except `/login` and `/api/login`) are protected by the middleware in `src/proxy.ts` (Next.js 16's `proxy.ts` is the middleware file — it shows as `ƒ Proxy (Middleware)` in the build).
- The auth check (`isAuthedRequest`, used in middleware and API routes; `isAuthed`, used in server components) is **async** and compares the cookie against `authToken()`, hashed via **Web Crypto** (`crypto.subtle`) so the same code runs in Edge and Node. `lib/auth.server.ts` holds only the Node-only `verifyPassword()`.
- Cookies are set `Secure` in all environments (`COOKIE_SECURE` in `lib/auth.ts`); `httpOnly` + `sameSite=lax`.
- `getAppSecret()` (in `lib/auth.ts`) throws if `APP_SECRET` is unset — it underpins both the auth token and credential encryption (warns if shorter than 16 chars).

## S3 Connections

- The **active connection** (bucket + credentials) is resolved by `lib/connection.ts`:
  a saved connection from the **SQLite DB** (active row) takes precedence, otherwise the
  env default, otherwise none (the browse page shows a connection form).
- Saved connections live in the `Connection` table; which one is active plus the
  env-default hidden/override state live in a single `AppSettings` row (id `"global"`).
  This is a **global/shared** store (no per-user scoping yet — that's a future addition
  once SSO provides identity, via a `userId` column).
- Runtime connections are validated with a real `ListObjectsV2` call before saving. The
  **secret access key is stored AES-256-GCM-encrypted** (scrypt key from `APP_SECRET`) in
  the `secretEnc` column — never plaintext — and is never exposed to client JS (the
  switcher receives a sanitized list with no secret keys).
- **Security**: credentials entered at runtime are entrusted to the app — prefer
  **read-only / least-privilege IAM keys** (or temporary STS credentials).

## Common Commands

```bash
npm run dev     # Start dev server on http://localhost:3000
npm run build   # Production build
npm run start   # Start production server
npm run lint    # Run ESLint

# Database (Prisma + SQLite)
npx prisma migrate dev     # create/apply migrations + (re)create prisma/dev.db in dev
npx prisma migrate deploy  # apply committed migrations (fresh clone / production)
npx prisma generate        # regenerate the client (also runs on `npm install` via postinstall)
npx prisma studio          # browse the local DB
```

On a fresh clone: `npm install` (runs `prisma generate`) then `npx prisma migrate dev`
to create the local `prisma/dev.db` from the committed migrations. The DB uses a literal
SQLite path in `schema.prisma` (`file:./dev.db`), so no `DATABASE_URL` env var is needed.

## Key Patterns

- **S3 listing**: `listPrefix(conn, prefix)` uses `ListObjectsV2Command` with `Delimiter: "/"` for one-level-deep listing. Returns `{ folders: string[], files: S3File[] }`. Takes the active `S3Connection`.
- **Presigned URLs**: `presignGet(conn, key, expiresIn=300)` generates a 5-minute presigned GET URL. Content-Type and Content-Disposition are set so browsers render files inline.
- **File routing**: Browse page at `/browse/[...path]`, preview at `/preview/[...key]`. Path segments are URL-encoded/decoded to handle spaces and special characters.
- **Inline styles**: UI uses inline `React.CSSProperties` style objects — no CSS modules or Tailwind.
