# S3 Storage Viewer

A Next.js 16 app for browsing and previewing files stored in an AWS S3 bucket, protected by a simple password-based auth.

## Stack

- **Framework**: Next.js 16 (App Router) with React 19
- **Language**: TypeScript 5
- **AWS**: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`
- **Runtime**: Node.js (server components/routes), Edge (middleware)

## Project Structure

```
src/
  app/
    api/
      list/route.ts       — GET /api/list?prefix= — lists folders & files at a prefix
      login/route.ts      — POST /api/login — validates APP_PASSWORD, sets auth cookie
      logout/route.ts     — POST /api/logout — clears auth cookie
      signed-url/route.ts — GET /api/signed-url?key= — returns a presigned S3 URL
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
  lib/
    s3.ts                 — S3 client, listPrefix(), presignGet(), contentTypeFromKey()
    auth.ts               — Cookie-based auth helpers (Edge-safe)
    auth.server.ts        — Server-component auth helpers
  proxy.ts                — Middleware: redirects unauthenticated requests to /login
```

## Environment Variables

Copy `.env.example` to `.env.local` and fill in all values:

```
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_BUCKET=
APP_PASSWORD=   # password users enter at /login
APP_SECRET=     # long random string stored in the auth cookie
```

## Auth Model

- Password-only auth: `APP_PASSWORD` is checked on login; on success, a cookie is set to `APP_SECRET`.
- All routes (except `/login` and `/api/login`) are protected by the middleware in `src/proxy.ts`.
- Edge middleware uses `isAuthedRequest()` (plain string comparison, no Node.js crypto).
- Server components use `isAuthed()` from `lib/auth.server.ts` (Next.js async cookie store).

## Common Commands

```bash
npm run dev     # Start dev server on http://localhost:3000
npm run build   # Production build
npm run start   # Start production server
npm run lint    # Run ESLint
```

## Key Patterns

- **S3 listing**: `listPrefix(prefix)` uses `ListObjectsV2Command` with `Delimiter: "/"` for one-level-deep listing. Returns `{ folders: string[], files: S3File[] }`.
- **Presigned URLs**: `presignGet(key, expiresIn=300)` generates a 5-minute presigned GET URL. Content-Type and Content-Disposition are set so browsers render files inline.
- **File routing**: Browse page at `/browse/[...path]`, preview at `/preview/[...key]`. Path segments are URL-encoded/decoded to handle spaces and special characters.
- **Inline styles**: UI uses inline `React.CSSProperties` style objects — no CSS modules or Tailwind.
