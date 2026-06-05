# Using Context7 to enrich documentation

Context7 serves up-to-date documentation and code examples for libraries and
frameworks. Use it so the examples and API references you write reflect the
library's *current* behavior rather than whatever your training data happened to
capture. This matters most for fast-moving libraries (Next.js, React, AWS SDKs,
Prisma, Tailwind) where APIs shift between versions.

## The two-call flow

Context7 exposes two tools. You almost always call them in this order:

### 1. `resolve-library-id`

Turn a human library name into a Context7 ID (`/org/project`).

- `libraryName`: the official name with proper punctuation — `"Next.js"`, not
  `"nextjs"`; `"Three.js"`, not `"threejs"`.
- `query`: what you're trying to document, used to rank results.

It returns candidate libraries with IDs, reputation, snippet counts, and
versions. Pick by name match + reputation + coverage. If the repo pins a version
(check `package.json` / lockfile) and that version appears in the results, prefer
the `/org/project/version` form so the docs match the installed release.

**Skip this call** only when the user (or you) already has an exact ID in
`/org/project` or `/org/project/version` form — then go straight to `query-docs`.

### 2. `query-docs`

Fetch docs for the resolved ID.

- `libraryId`: the exact ID from step 1 (e.g. `/vercel/next.js`).
- `query`: a *specific* question. Specificity is everything here.

## Write specific queries

The query quality determines the answer quality. Include the concrete thing you
need to document.

**Good:**
- "App Router route handler (GET) signature, params, and runtime/segment config"
- "S3 presigned GET URL with ResponseContentDisposition using s3-request-presigner"
- "useEffect cleanup function timing and dependency array rules"

**Bad:** `"routes"`, `"s3"`, `"hooks"` — too vague to return useful material.

## Worked example

Documenting an S3 listing helper in a Next.js project:

1. `resolve-library-id` → `libraryName: "AWS SDK for JavaScript"`,
   `query: "list S3 objects with delimiter and generate presigned URLs"`.
   Returns e.g. `/aws/aws-sdk-js-v3`.
2. `query-docs` → `libraryId: "/aws/aws-sdk-js-v3"`,
   `query: "ListObjectsV2Command with Delimiter for one-level listing and presigned GET URL expiry"`.
3. Use the returned signatures and options to confirm the example matches the
   current SDK, then adapt it to how *this* repo calls it (the real function
   names, the real bucket/prefix variables).

## Limits and etiquette

- Don't call either tool more than **3 times per question**. Plan your queries.
- Query only for libraries the doc genuinely explains. An incidental dependency
  doesn't need a Context7 lookup — a plain mention is fine.
- Context7 gives you the *library's* truth; the *codebase's* truth comes from
  reading the code. Good docs reconcile the two — show the current API as this
  project actually uses it.
- Never put secrets (keys, tokens, credentials, proprietary code) into a query.
